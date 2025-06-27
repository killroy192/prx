// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier} from "../circuits/spend_32/target/HonkVerifier_spend_32.sol";

contract Spend32Verifier {
    HonkVerifier public verifier = new HonkVerifier();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
