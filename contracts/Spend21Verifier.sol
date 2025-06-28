// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend21Verifier_} from "../circuits/spend_21/target/HonkVerifier_spend_21.sol";

contract Spend21Verifier {
    Spend21Verifier_ public verifier = new Spend21Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
