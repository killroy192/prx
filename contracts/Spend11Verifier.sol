// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend11Verifier_} from "../circuits/spend_11/target/HonkVerifier_spend_11.sol";

contract Spend11Verifier {
    Spend11Verifier_ public verifier = new Spend11Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
