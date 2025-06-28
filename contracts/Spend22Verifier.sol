// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend22Verifier_} from "../circuits/spend_22/target/HonkVerifier_spend_22.sol";

contract Spend22Verifier {
    Spend22Verifier_ public verifier = new Spend22Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
