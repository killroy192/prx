// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenDeposit
 * @dev A simple contract that accepts ERC20 tokens and stores them
 */
contract TokenDeposit is ReentrancyGuard, Ownable {
    // Mapping to track deposits per user and token
    mapping(address => mapping(address => uint256)) public deposits;

    // Mapping to track total deposits per token
    mapping(address => uint256) public totalDeposits;

    // Events
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Deposit ERC20 tokens into the contract
     * @param token The ERC20 token address to deposit
     * @param amount The amount of tokens to deposit
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "TokenDeposit: Invalid token address");
        require(amount > 0, "TokenDeposit: Amount must be greater than 0");

        // Transfer tokens from user to contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Update deposit records
        deposits[msg.sender][token] += amount;
        totalDeposits[token] += amount;

        emit TokenDeposited(msg.sender, token, amount);
    }

    /**
     * @dev Get the balance of a specific token for a user
     * @param user The user address
     * @param token The ERC20 token address
     * @return The balance of the token for the user
     */
    function getBalance(address user, address token) external view returns (uint256) {
        return deposits[user][token];
    }

    /**
     * @dev Get the total deposits for a specific token
     * @param token The ERC20 token address
     * @return The total amount of tokens deposited
     */
    function getTotalDeposits(address token) external view returns (uint256) {
        return totalDeposits[token];
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
