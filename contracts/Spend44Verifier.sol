// SPDX-License-Identifier: Apache-2.0
// Copyright 2022 Aztec
pragma solidity >=0.8.21;

import {HonkVerifier as Spend44Verifier_} from "../circuits/spend_44/target/HonkVerifier_spend_44.sol";

contract Spend44Verifier {
    Spend44Verifier_ public verifier = new Spend44Verifier_();

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return verifier.verify(proof, publicInputs);
    }
}
