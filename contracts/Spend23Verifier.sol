// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend23Verifier_} from "../circuits/spend_23/target/HonkVerifier_spend_23.sol";

contract Spend23Verifier {
    Spend23Verifier_ public verifier = new Spend23Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
