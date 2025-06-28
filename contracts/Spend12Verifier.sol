// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend12Verifier_} from "../circuits/spend_12/target/HonkVerifier_spend_12.sol";

contract Spend12Verifier {
    Spend12Verifier_ public verifier = new Spend12Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
