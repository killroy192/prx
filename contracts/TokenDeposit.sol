// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DepositVerifier.sol";

/**
 * @title TokenDeposit
 * @dev A contract that accepts ERC20 tokens and stores them with commitments and ZK proofs
 */
contract TokenDeposit is ReentrancyGuard, Ownable {
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

    // Events
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event CommitmentsAssigned(address indexed user, address indexed token, uint256 indexed poseidonHash);

    constructor(address _depositVerifier) Ownable(msg.sender) {
        require(_depositVerifier != address(0), "TokenDeposit: Invalid verifier address");
        depositVerifier = DepositVerifier(_depositVerifier);
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

        // Transfer tokens from user to contract
        IERC20(token).transferFrom(msg.sender, address(this), total_amount);
        emit TokenDeposited(msg.sender, token, total_amount);

        // Assign commitments to addresses
        for (uint256 i = 0; i < commitments.length; i++) {
            commitmentsMap[token][commitments[i].poseidonHash] = Commitment({owner: commitments[i].owner, spent: false});
            emit CommitmentsAssigned(commitments[i].owner, token, commitments[i].poseidonHash);
        }
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
}
