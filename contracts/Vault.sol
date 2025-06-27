// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DepositVerifier.sol";
import "./PoseidonWrapper.sol";

/**
 * @title Vault
 * @dev A contract that manages ERC20 tokens with commitments and ZK proofs for deposits and other operations
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

    // Mapping to track if a commitment hash has been deposited
    mapping(address => mapping(uint256 => Commitment)) public commitmentsMap;

    // DepositVerifier contract for ZK proof validation
    DepositVerifier public immutable depositVerifier;

    // PoseidonWrapper contract for on-chain hash computation
    PoseidonWrapper public immutable poseidonWrapper;

    // Events
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event CommitmentsAssigned(address indexed user, address indexed token, uint256 indexed poseidonHash);
    event CommitmentWithdrawn(
        address indexed user, address indexed token, uint256 indexed poseidonHash, uint256 amount
    );

    constructor(address _depositVerifier, address _poseidonWrapper) Ownable(msg.sender) {
        require(_depositVerifier != address(0), "TokenDeposit: Invalid verifier address");
        require(_poseidonWrapper != address(0), "TokenDeposit: Invalid wrapper address");
        depositVerifier = DepositVerifier(_depositVerifier);
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
        require(token != address(0), "TokenDeposit: Invalid token address");
        require(total_amount > 0, "TokenDeposit: Amount must be greater than 0");
        // Check that no commitment has been used before
        for (uint256 i = 0; i < 3; i++) {
            require(
                commitmentsMap[token][commitments[i].poseidonHash].owner == address(0),
                "TokenDeposit: Commitment already used"
            );
        }

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(commitments[0].poseidonHash);
        publicInputs[1] = bytes32(commitments[1].poseidonHash);
        publicInputs[2] = bytes32(commitments[2].poseidonHash);
        publicInputs[3] = bytes32(total_amount);

        // Verify ZK proof
        bool isValidProof = depositVerifier.verify(proof, publicInputs);
        require(isValidProof, "TokenDeposit: Invalid ZK proof");

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
     * @dev Emergency function to withdraw all tokens (owner only)
     * @param token The ERC20 token address to withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(0), "TokenDeposit: Invalid token address");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "TokenDeposit: No tokens to withdraw");

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
