// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {DepositVerifier} from "./DepositVerifier.sol";
import {Spend11Verifier} from "./Spend11Verifier.sol";
import {Spend12Verifier} from "./Spend12Verifier.sol";
import {Spend13Verifier} from "./Spend13Verifier.sol";
import {Spend21Verifier} from "./Spend21Verifier.sol";
import {Spend22Verifier} from "./Spend22Verifier.sol";
import {Spend23Verifier} from "./Spend23Verifier.sol";
import {Spend31Verifier} from "./Spend31Verifier.sol";
import {Spend32Verifier} from "./Spend32Verifier.sol";
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

    // Spend12Verifier contract for ZK proof validation
    Spend12Verifier public immutable spend12Verifier;

    // Spend13Verifier contract for ZK proof validation
    Spend13Verifier public immutable spend13Verifier;

    // Spend21Verifier contract for ZK proof validation
    Spend21Verifier public immutable spend21Verifier;

    // Spend22Verifier contract for ZK proof validation
    Spend22Verifier public immutable spend22Verifier;

    // Spend23Verifier contract for ZK proof validation
    Spend23Verifier public immutable spend23Verifier;

    // Spend31Verifier contract for ZK proof validation
    Spend31Verifier public immutable spend31Verifier;

    // Spend32Verifier contract for ZK proof validation
    Spend32Verifier public immutable spend32Verifier;

    // PoseidonWrapper contract for on-chain hash computation
    PoseidonWrapper public immutable poseidonWrapper;

    // Events
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event CommitmentCreated(address indexed token, uint256 indexed poseidonHash, address indexed owner);
    event CommitmentRemoved(address indexed token, uint256 indexed poseidonHash, address indexed owner);
    event TransactionSpent(address indexed token, uint256[] inputHashes, uint256[] outputHashes, uint256 fee);

    constructor(
        address _depositVerifier,
        address _spend11Verifier,
        address _spend12Verifier,
        address _spend13Verifier,
        address _spend21Verifier,
        address _spend22Verifier,
        address _spend23Verifier,
        address _spend31Verifier,
        address _spend32Verifier,
        address _poseidonWrapper
    ) Ownable(msg.sender) {
        require(_depositVerifier != address(0), "Vault: Invalid deposit verifier address");
        require(_spend11Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend12Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend13Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend21Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend22Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend23Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend31Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_spend32Verifier != address(0), "Vault: Invalid spend verifier address");
        require(_poseidonWrapper != address(0), "Vault: Invalid wrapper address");
        depositVerifier = DepositVerifier(_depositVerifier);
        spend11Verifier = Spend11Verifier(_spend11Verifier);
        spend12Verifier = Spend12Verifier(_spend12Verifier);
        spend13Verifier = Spend13Verifier(_spend13Verifier);
        spend21Verifier = Spend21Verifier(_spend21Verifier);
        spend22Verifier = Spend22Verifier(_spend22Verifier);
        spend23Verifier = Spend23Verifier(_spend23Verifier);
        spend31Verifier = Spend31Verifier(_spend31Verifier);
        spend32Verifier = Spend32Verifier(_spend32Verifier);
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
            emit CommitmentCreated(token, commitments[i].poseidonHash, commitments[i].owner);
        }

        // Transfer tokens from user to contract (external call)
        IERC20(token).transferFrom(msg.sender, address(this), total_amount);
        emit TokenDeposited(msg.sender, token, total_amount);
    }

    /**
     * @dev Validate that all input indexes are covered and unique
     */
    function _validateInputIndexes(Transaction calldata transaction) internal pure {
        uint256 totalInputIndexes = 0;
        for (uint256 i = 0; i < transaction.inputWitnesses.length; i++) {
            totalInputIndexes += transaction.inputWitnesses[i].indexes.length;
        }
        require(totalInputIndexes == transaction.inputsPoseidonHashes.length, "Vault: Invalid input indexes coverage");

        bool[] memory inputIndexesUsed = new bool[](transaction.inputsPoseidonHashes.length);
        for (uint256 i = 0; i < transaction.inputWitnesses.length; i++) {
            for (uint256 j = 0; j < transaction.inputWitnesses[i].indexes.length; j++) {
                uint8 index = transaction.inputWitnesses[i].indexes[j];
                require(index < transaction.inputsPoseidonHashes.length, "Vault: Input index out of bounds");
                require(!inputIndexesUsed[index], "Vault: Duplicate input index");
                inputIndexesUsed[index] = true;
            }
        }
    }

    /**
     * @dev Validate that all output indexes are covered and unique
     */
    function _validateOutputIndexes(Transaction calldata transaction) internal pure {
        uint256 totalOutputIndexes = 0;
        for (uint256 i = 0; i < transaction.outputWitnesses.length; i++) {
            totalOutputIndexes += transaction.outputWitnesses[i].indexes.length;
        }
        require(
            totalOutputIndexes == transaction.outputsPoseidonHashes.length, "Vault: Invalid output indexes coverage"
        );

        bool[] memory outputIndexesUsed = new bool[](transaction.outputsPoseidonHashes.length);
        for (uint256 i = 0; i < transaction.outputWitnesses.length; i++) {
            for (uint256 j = 0; j < transaction.outputWitnesses[i].indexes.length; j++) {
                uint8 index = transaction.outputWitnesses[i].indexes[j];
                require(index < transaction.outputsPoseidonHashes.length, "Vault: Output index out of bounds");
                require(!outputIndexesUsed[index], "Vault: Duplicate output index");
                outputIndexesUsed[index] = true;
            }
        }
    }

    /**
     * @dev Verify input witnesses and signatures
     */
    function _verifyInputWitnesses(Transaction calldata transaction) internal view {
        for (uint256 i = 0; i < transaction.inputWitnesses.length; i++) {
            InputWitnesses memory inputWitness = transaction.inputWitnesses[i];

            // Get the first input hash to determine the owner
            uint256 firstInputIndex = inputWitness.indexes[0];
            uint256 firstInputHash = transaction.inputsPoseidonHashes[firstInputIndex];
            Commitment storage inputCommitment = commitmentsMap[transaction.token][firstInputHash];
            require(inputCommitment.owner != address(0), "Vault: Input commitment not found");

            // Verify that all inputs in this witness belong to the same owner
            for (uint256 j = 1; j < inputWitness.indexes.length; j++) {
                uint256 inputIndex = inputWitness.indexes[j];
                uint256 inputHash = transaction.inputsPoseidonHashes[inputIndex];
                Commitment storage commitment = commitmentsMap[transaction.token][inputHash];
                require(commitment.owner == inputCommitment.owner, "Vault: Input witness contains different owners");
            }

            // Verify ECDSA signature for this input witness
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
                SignatureChecker.isValidSignatureNow(inputCommitment.owner, transactionHash, inputWitness.signature),
                "Vault: Invalid signature"
            );
        }
    }

    /**
     * @dev Delete input commitments and emit events
     */
    function _deleteInputCommitments(Transaction calldata transaction) internal {
        for (uint256 i = 0; i < transaction.inputsPoseidonHashes.length; i++) {
            uint256 inputHash = transaction.inputsPoseidonHashes[i];
            address inputOwner = commitmentsMap[transaction.token][inputHash].owner;
            delete commitmentsMap[transaction.token][inputHash];
            emit CommitmentRemoved(transaction.token, inputHash, inputOwner);
        }
    }

    /**
     * @dev Create output commitments using indexes from output witnesses
     */
    function _createOutputCommitments(Transaction calldata transaction) internal {
        for (uint256 i = 0; i < transaction.outputWitnesses.length; i++) {
            OutputsParams memory outputWitness = transaction.outputWitnesses[i];
            address outputOwner = outputWitness.owner;

            for (uint256 j = 0; j < outputWitness.indexes.length; j++) {
                uint8 outputIndex = outputWitness.indexes[j];
                uint256 outputHash = transaction.outputsPoseidonHashes[outputIndex];
                commitmentsMap[transaction.token][outputHash] = Commitment({owner: outputOwner, spent: false});
                emit CommitmentCreated(transaction.token, outputHash, outputOwner);
            }
        }
    }

    /**
     * @dev Craft public inputs array for ZK proof verification
     * @param transaction The transaction data
     * @return publicInputs Array of public inputs in the format: [inputHashes..., outputHashes..., fee]
     */
    function _craftPublicInputs(Transaction calldata transaction)
        internal
        pure
        returns (bytes32[] memory publicInputs)
    {
        uint256 totalInputs = transaction.inputsPoseidonHashes.length;
        uint256 totalOutputs = transaction.outputsPoseidonHashes.length;

        // Initialize array: inputs + outputs + fee
        publicInputs = new bytes32[](totalInputs + totalOutputs + 1);

        // Fill input hashes
        for (uint256 i = 0; i < totalInputs; i++) {
            publicInputs[i] = bytes32(transaction.inputsPoseidonHashes[i]);
        }

        // Fill output hashes
        for (uint256 i = 0; i < totalOutputs; i++) {
            publicInputs[totalInputs + i] = bytes32(transaction.outputsPoseidonHashes[i]);
        }

        // Fill fee at the end
        publicInputs[totalInputs + totalOutputs] = bytes32(uint256(transaction.fee));
    }

    /**
     * @dev Spend commitments by creating new ones (supports multiple inputs and outputs)
     * @param transaction The transaction data
     * @param proof ZK proof bytes
     */
    function spend(Transaction calldata transaction, bytes calldata proof) external nonReentrant {
        require(transaction.token != address(0), "Vault: Invalid token address");
        require(transaction.deadline > block.timestamp, "Vault: Transaction expired");
        require(transaction.fee == 0, "Vault: Fee not supported yet");
        require(transaction.inputsPoseidonHashes.length > 0, "Vault: No inputs provided");
        require(transaction.outputsPoseidonHashes.length > 0, "Vault: No outputs provided");

        // Validate indexes using separate methods to reduce stack size
        _validateInputIndexes(transaction);
        _validateOutputIndexes(transaction);

        // Verify input witnesses and signatures
        _verifyInputWitnesses(transaction);

        // Craft public inputs for ZK proof verification
        bytes32[] memory publicInputs = _craftPublicInputs(transaction);

        // Verify ZK proof based on input/output combination
        bool isValidProof = false;
        if (transaction.inputsPoseidonHashes.length == 1 && transaction.outputsPoseidonHashes.length == 1) {
            isValidProof = spend11Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 1 && transaction.outputsPoseidonHashes.length == 2) {
            isValidProof = spend12Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 1 && transaction.outputsPoseidonHashes.length == 3) {
            isValidProof = spend13Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 2 && transaction.outputsPoseidonHashes.length == 1) {
            isValidProof = spend21Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 2 && transaction.outputsPoseidonHashes.length == 2) {
            isValidProof = spend22Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 2 && transaction.outputsPoseidonHashes.length == 3) {
            isValidProof = spend23Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 3 && transaction.outputsPoseidonHashes.length == 1) {
            isValidProof = spend31Verifier.verify(proof, publicInputs);
        } else if (transaction.inputsPoseidonHashes.length == 3 && transaction.outputsPoseidonHashes.length == 2) {
            isValidProof = spend32Verifier.verify(proof, publicInputs);
        }

        require(isValidProof, "Vault: Invalid ZK proof");

        // Delete all input commitments from storage (saves gas)
        _deleteInputCommitments(transaction);

        // Create new output commitments using the indexes from output witnesses
        _createOutputCommitments(transaction);

        // Emit single transaction event for the atomic operation
        emit TransactionSpent(
            transaction.token, transaction.inputsPoseidonHashes, transaction.outputsPoseidonHashes, transaction.fee
        );
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
        emit CommitmentRemoved(token, poseidonHash, msg.sender);
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
