// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import { PoseidonT3 } from "poseidon-solidity/PoseidonT3.sol";

/**
 * @title PoseidonWrapper
 * @dev A wrapper contract for gas-efficient Poseidon hash computation on-chain
 * Uses the poseidon-solidity library for optimized hash calculations
 */
contract PoseidonWrapper {
    /**
     * @dev Computes Poseidon hash of two field elements (amount and entropy)
     * @param amount The amount field element
     * @param entropy The entropy field element
     * @return The computed Poseidon hash
     */
    function hash2(uint256 amount, uint256 entropy) external pure returns (uint256) {
        return PoseidonT3.hash([amount, entropy]);
    }
}
