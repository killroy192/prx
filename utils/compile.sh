#!/bin/bash

function compile_circuit {
  cd ./$1

  nargo compile;

  # Generate the verification key. You need to pass the `--oracle_hash keccak` flag when generating vkey and proving
  # to instruct bb to use keccak as the hash function, which is more optimal in Solidity
  bb write_vk -b ./target/$1.json -o ./target --oracle_hash keccak;

  # Generate the Solidity verifier from the vkey
  bb write_solidity_verifier -k ./target/vk -o ./target/HonkVerifier_$1.sol;

  cd ../
}

cd circuits

compile_circuit deposit
compile_circuit spend_11
compile_circuit spend_12
compile_circuit spend_21
compile_circuit spend_22