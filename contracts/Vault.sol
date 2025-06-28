// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {DepositVerifier} from "./DepositVerifier.sol";
import {Spend11Verifier} from "./Spend11Verifier.sol";
import {PoseidonWrapper} from "./PoseidonWrapper.sol";

/**
 * @title Vault
 * @dev A contract that manages ERC20 tokens with commitments and ZK proofs for deposits, withdrawals, and spending
 */
contract Vault is ReentrancyGuard, Ownable {
    // Represents a UTXO commitment: who can spend it and whether it's used
    struct Commitment {
        address owner; // authorized spender (via ECDSA)
        bool spent; // true if already consumed or withdrawn
    }

    struct DepositCommitmentParams {
        uint256 poseidonHash;
        address owner;
    }

    struct InputWitnesses {
        bytes signature; // ECDSA signature over transaction hash
        uint8[] indexes; // positions in the inputsPoseidonHashes
    }

    struct OutputsParams {
        address owner; // owner of new UTXO commitment
        uint8[] indexes; // positions in the outputsPoseidonHashes
    }

    struct Transaction {
        uint256 deadline; // the timestamp until signature is valid
        address token;
        uint256[] inputsPoseidonHashes; // UTXO commitments to consume
        uint256[] outputsPoseidonHashes; // New UTXO commitments to create
        InputWitnesses[] inputWitnesses; // signatures for spending inputs
        OutputsParams[] outputWitnesses; // addresses for outputs
        uint240 fee; // for now will be always 0
    }

    // Mapping to track if a commitment hash has been deposited
    mapping(address => mapping(uint256 => Commitment)) public commitmentsMap;

    // DepositVerifier contract for ZK proof validation
    DepositVerifier public immutable depositVerifier;

    // Spend11Verifier contract for ZK proof validation
    Spend11Verifier public immutable spend11Verifier;

    // PoseidonWrapper contract for on-chain hash computation
    PoseidonWrapper public immutable poseidonWrapper;

    // Events
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event CommitmentsAssigned(address indexed user, address indexed token, uint256 indexed poseidonHash);
    event CommitmentWithdrawn(
        address indexed user, address indexed token, uint256 indexed poseidonHash, uint256 amount
    );
    event TransactionSpent(
        address indexed token, uint256 indexed inputHash, uint256 indexed outputHash, uint256 amount
    );

    constructor(address _depositVerifier, address _spend11Verifier, address _poseidonWrapper) Ownable(msg.sender) {
        require(_depositVerifier != address(0), "Vault: Invalid deposit verifier address");
        require(_spend11Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_poseidonWrapper != address(0), "Vault: Invalid wrapper address");
        depositVerifier = DepositVerifier(_depositVerifier);
        spend11Verifier = Spend11Verifier(_spend11Verifier);
        poseidonWrapper = PoseidonWrapper(_poseidonWrapper);
    }

    /**
     * @dev Deposit tokens with commitments and ZK proof validation
     * @param token The ERC20 token address to deposit
     * @param total_amount The amount of tokens to deposit
     * @param commitments Array of commitments
     * @param proof ZK proof bytes
     */
    function deposit(
        address token,
        uint256 total_amount,
        DepositCommitmentParams[3] calldata commitments,
        bytes calldata proof
    ) external nonReentrant {
        require(token != address(0), "Vault: Invalid token address");
        require(total_amount > 0, "Vault: Amount must be greater than 0");
        // Check that no commitment has been used before
        for (uint256 i = 0; i < 3; i++) {
            require(
                commitmentsMap[token][commitments[i].poseidonHash].owner == address(0), "Vault: Commitment already used"
            );
        }

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(commitments[0].poseidonHash);
        publicInputs[1] = bytes32(commitments[1].poseidonHash);
        publicInputs[2] = bytes32(commitments[2].poseidonHash);
        publicInputs[3] = bytes32(total_amount);

        // Verify ZK proof
        bool isValidProof = depositVerifier.verify(proof, publicInputs);
        require(isValidProof, "Vault: Invalid ZK proof");

        // Assign commitments to addresses before external call
        for (uint256 i = 0; i < commitments.length; i++) {
            commitmentsMap[token][commitments[i].poseidonHash] = Commitment({owner: commitments[i].owner, spent: false});
            emit CommitmentsAssigned(commitments[i].owner, token, commitments[i].poseidonHash);
        }

        // Transfer tokens from user to contract (external call)
        IERC20(token).transferFrom(msg.sender, address(this), total_amount);
        emit TokenDeposited(msg.sender, token, total_amount);
    }

    /**
     * @dev Spend a commitment by creating a new one (1-to-1 transaction)
     * @param transaction The transaction data
     * @param proof ZK proof bytes
     */
    function spend(Transaction calldata transaction, bytes calldata proof) external nonReentrant {
        require(transaction.token != address(0), "Vault: Invalid token address");
        require(transaction.deadline > block.timestamp, "Vault: Transaction expired");
        require(transaction.fee == 0, "Vault: Fee not supported yet");
        require(transaction.inputsPoseidonHashes.length == 1, "Vault: Only 1-to-1 transactions supported");
        require(transaction.outputsPoseidonHashes.length == 1, "Vault: Only 1-to-1 transactions supported");
        require(transaction.inputWitnesses.length == 1, "Vault: Invalid input witnesses");
        require(transaction.outputWitnesses.length == 1, "Vault: Invalid output witnesses");

        uint256 inputHash = transaction.inputsPoseidonHashes[0];
        uint256 outputHash = transaction.outputsPoseidonHashes[0];

        // Check that input commitment exists
        Commitment storage inputCommitment = commitmentsMap[transaction.token][inputHash];
        require(inputCommitment.owner != address(0), "Vault: Input commitment not found");

        // Verify ECDSA signature
        bytes32 transactionHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(
                abi.encode(
                    transaction.deadline,
                    transaction.token,
                    transaction.inputsPoseidonHashes,
                    transaction.outputsPoseidonHashes,
                    transaction.outputWitnesses,
                    transaction.fee
                )
            )
        );

        require(
            SignatureChecker.isValidSignatureNow(
                inputCommitment.owner, transactionHash, transaction.inputWitnesses[0].signature
            ),
            "Vault: Invalid signature"
        );

        // Verify ZK proof
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = bytes32(inputHash);
        publicInputs[1] = bytes32(outputHash);
        publicInputs[2] = bytes32(uint256(transaction.fee));

        bool isValidProof = spend11Verifier.verify(proof, publicInputs);
        require(isValidProof, "Vault: Invalid ZK proof");

        // Delete input commitment from storage (saves gas)
        delete commitmentsMap[transaction.token][inputHash];

        // Create new output commitment
        commitmentsMap[transaction.token][outputHash] =
            Commitment({owner: transaction.outputWitnesses[0].owner, spent: false});

        emit TransactionSpent(transaction.token, inputHash, outputHash, 0); // amount would be derived from circuit
    }

    /**
     * @dev Emergency function to withdraw all tokens (owner only)
     * @param token The ERC20 token address to withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(0), "Vault: Invalid token address");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "Vault: No tokens to withdraw");

        IERC20(token).transfer(owner(), balance);
    }

    /**
     * @dev Withdraw a commitment by providing amount and secret
     * @param token The ERC20 token address
     * @param amount The amount of tokens to withdraw
     * @param entropy The secret entropy used to create the commitment
     */
    function withdraw(address token, uint256 amount, uint256 entropy) external nonReentrant {
        require(token != address(0), "Vault: Invalid token address");
        require(amount > 0, "Vault: Amount must be greater than 0");

        // Compute the Poseidon hash on-chain
        uint256 poseidonHash = poseidonWrapper.hash2(amount, entropy);

        // Get the commitment
        Commitment storage commitment = commitmentsMap[token][poseidonHash];
        require(commitment.owner != address(0), "Vault: Commitment not found");
        require(commitment.owner == msg.sender, "Vault: Only assigned address can withdraw");

        // Delete the commitment from storage (saves gas)
        delete commitmentsMap[token][poseidonHash];

        // Transfer tokens to the owner
        IERC20(token).transfer(msg.sender, amount);

        // Emit withdrawal event
        emit CommitmentWithdrawn(msg.sender, token, poseidonHash, amount);
    }

    /**
     * @dev Compute Poseidon hash of amount and entropy on-chain
     * @param amount The amount field element
     * @param entropy The entropy field element
     * @return The computed Poseidon hash
     */
    function computePoseidonHash(uint256 amount, uint256 entropy) external view returns (uint256) {
        return poseidonWrapper.hash2(amount, entropy);
    }

    /**
     * @dev Get commitment details for a given token and poseidon hash
     * @param token The ERC20 token address
     * @param poseidonHash The poseidon hash to look up
     * @return owner The owner of the commitment
     * @return spent Whether the commitment has been spent
     */
    function getCommitment(address token, uint256 poseidonHash) external view returns (address owner, bool spent) {
        Commitment memory commitment = commitmentsMap[token][poseidonHash];
        return (commitment.owner, commitment.spent);
    }
}
