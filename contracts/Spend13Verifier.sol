// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend13Verifier_} from "../circuits/spend_13/target/HonkVerifier_spend_13.sol";

contract Spend13Verifier {
    Spend13Verifier_ public verifier = new Spend13Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
