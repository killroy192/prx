// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend32Verifier_} from "../circuits/spend_32/target/HonkVerifier_spend_32.sol";

contract Spend32Verifier {
    Spend32Verifier_ public verifier = new Spend32Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
