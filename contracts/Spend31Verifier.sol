// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend31Verifier_} from "../circuits/spend_31/target/HonkVerifier_spend_31.sol";

contract Spend31Verifier {
    Spend31Verifier_ public verifier = new Spend31Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
