// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend33Verifier_} from "../circuits/spend_33/target/HonkVerifier_spend_33.sol";

contract Spend33Verifier {
    Spend33Verifier_ public verifier = new Spend33Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
