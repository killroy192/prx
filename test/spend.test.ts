import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import spendCircuit from "../circuits/spend_11/target/spend_11.json";
import { Vault } from "../typechain-types/contracts/Vault";

const abi = ethers.AbiCoder.defaultAbiCoder();

describe("Vault - Spend", function () {
    it("Should successfully spend a commitment (1-to-1 transaction)", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // First, create and deposit a commitment
        const inputCommitment = {
            amount: "1000000000000000000", // 1 token
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "1000000000000000000";

        // Create zero-amount commitments for deposit
        const zeroCommitment1 = {
            amount: "0",
            entropy:
                "111111111111111111111111111111111111111111111111111111111111111",
        };
        const zeroCommitment2 = {
            amount: "0",
            entropy:
                "222222222222222222222222222222222222222222222222222222222222222",
        };

        // Compute poseidon hashes for deposit
        const inputHash = await computePoseidon(inputCommitment);
        const hashZero1 = await computePoseidon(zeroCommitment1);
        const hashZero2 = await computePoseidon(zeroCommitment2);

        const depositInput = {
            commitments: [inputCommitment, zeroCommitment1, zeroCommitment2],
            hashes: [inputHash, hashZero1, hashZero2],
            total_amount: totalAmount,
        };

        const { witness: depositWitness } = await noir.execute(depositInput);
        const { proof: depositProof } = await backend.generateProof(
            depositWitness,
            { keccak: true }
        );

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: inputHash, owner: user1.address },
            { poseidonHash: hashZero1, owner: user2.address },
            { poseidonHash: hashZero2, owner: user3.address },
        ];

        // Deposit tokens
        await mockToken
            .connect(user1)
            .approve(vault.target, BigInt(totalAmount));
        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                BigInt(totalAmount),
                depositCommitmentParams,
                depositProof
            );

        // Now create the spend transaction
        const outputCommitment = {
            amount: "1000000000000000000", // 1 token (no fee)
            entropy:
                "987654321098765432109876543210987654321098765432109876543210987",
        };

        const outputHash = await computePoseidon(outputCommitment);
        const fee = "0"; // No fee

        // Create spend circuit input
        const spendInput = {
            input: inputCommitment,
            output: outputCommitment,
            input_hash: inputHash,
            output_hash: outputHash,
            fee: fee,
        };

        // Initialize spend circuit
        const spendNoir = new Noir(spendCircuit as any);
        const spendBackend = new UltraHonkBackend(spendCircuit.bytecode);

        const { witness: spendWitness } = await spendNoir.execute(spendInput);
        const { proof: spendProof } = await spendBackend.generateProof(
            spendWitness,
            { keccak: true }
        );

        // Create transaction data
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const transaction = {
            deadline,
            token: mockToken.target,
            inputsPoseidonHashes: [inputHash],
            outputsPoseidonHashes: [outputHash],
            inputWitnesses: [
                {
                    signature: "0x", // Will be filled with actual signature
                    indexes: [0],
                },
            ],
            outputWitnesses: [
                {
                    owner: user2.address,
                    indexes: [0],
                },
            ],
            fee: BigInt(fee),
        };

        // Sign the transaction
        const hash = ethers.keccak256(
            abi.encode(
                [
                    "uint256",
                    "address",
                    "uint256[]",
                    "uint256[]",
                    "tuple(address,uint8[])[]",
                    "uint240",
                ],
                [
                    transaction.deadline,
                    transaction.token,
                    transaction.inputsPoseidonHashes,
                    transaction.outputsPoseidonHashes,
                    transaction.outputWitnesses.map((w) => [
                        w.owner,
                        w.indexes,
                    ]),
                    transaction.fee,
                ]
            )
        );

        const signature = await user1.signMessage(ethers.getBytes(hash));
        transaction.inputWitnesses[0].signature = signature;

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, spendProof);

        // Verify the input commitment is deleted
        const [inputOwner, inputSpent] = await vault.getCommitment(
            mockToken.target,
            inputHash
        );
        expect(inputOwner).to.equal(ethers.ZeroAddress);
        expect(inputSpent).to.equal(false);

        // Verify the output commitment is created
        const [outputOwner, outputSpent] = await vault.getCommitment(
            mockToken.target,
            outputHash
        );
        expect(outputOwner).to.equal(user2.address);
        expect(outputSpent).to.equal(false);
    });

    it("Should revert spending with expired deadline", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create and deposit a commitment (similar to above test)
        const inputCommitment = {
            amount: "1000000000000000000",
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "1000000000000000000";
        const zeroCommitment1 = {
            amount: "0",
            entropy:
                "111111111111111111111111111111111111111111111111111111111111111",
        };
        const zeroCommitment2 = {
            amount: "0",
            entropy:
                "222222222222222222222222222222222222222222222222222222222222222",
        };

        const inputHash = await computePoseidon(inputCommitment);
        const hashZero1 = await computePoseidon(zeroCommitment1);
        const hashZero2 = await computePoseidon(zeroCommitment2);

        const depositInput = {
            commitments: [inputCommitment, zeroCommitment1, zeroCommitment2],
            hashes: [inputHash, hashZero1, hashZero2],
            total_amount: totalAmount,
        };

        const { witness: depositWitness } = await noir.execute(depositInput);
        const { proof: depositProof } = await backend.generateProof(
            depositWitness,
            { keccak: true }
        );

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: inputHash, owner: user1.address },
            { poseidonHash: hashZero1, owner: user2.address },
            { poseidonHash: hashZero2, owner: user3.address },
        ];

        await mockToken
            .connect(user1)
            .approve(vault.target, BigInt(totalAmount));
        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                BigInt(totalAmount),
                depositCommitmentParams,
                depositProof
            );

        // Create spend transaction with expired deadline
        const outputCommitment = {
            amount: "1000000000000000000", // 1 token (no fee)
            entropy:
                "987654321098765432109876543210987654321098765432109876543210987",
        };

        const outputHash = await computePoseidon(outputCommitment);
        const fee = "0"; // No fee

        const spendInput = {
            input: inputCommitment,
            output: outputCommitment,
            input_hash: inputHash,
            output_hash: outputHash,
            fee: fee,
        };

        const spendNoir = new Noir(spendCircuit as any);
        const spendBackend = new UltraHonkBackend(spendCircuit.bytecode);

        const { witness: spendWitness } = await spendNoir.execute(spendInput);
        const { proof: spendProof } = await spendBackend.generateProof(
            spendWitness,
            { keccak: true }
        );

        const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        const transaction = {
            deadline: expiredDeadline,
            token: mockToken.target,
            inputsPoseidonHashes: [inputHash],
            outputsPoseidonHashes: [outputHash],
            inputWitnesses: [
                {
                    signature: "0x",
                    indexes: [0],
                },
            ],
            outputWitnesses: [
                {
                    owner: user2.address,
                    indexes: [0],
                },
            ],
            fee: BigInt(fee),
        };

        const encoded = abi.encode(
            [
                "uint256",
                "address",
                "uint256[]",
                "uint256[]",
                "tuple(address,uint8[])[]",
                "uint240",
            ],
            [
                transaction.deadline,
                transaction.token,
                transaction.inputsPoseidonHashes,
                transaction.outputsPoseidonHashes,
                transaction.outputWitnesses.map((w) => [w.owner, w.indexes]),
                transaction.fee,
            ]
        );
        const hash = ethers.keccak256(encoded);
        const signature = await user1.signMessage(ethers.getBytes(hash));
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to expired deadline
        await expect(
            vault.connect(user1).spend(transaction, spendProof)
        ).to.be.revertedWith("Vault: Transaction expired");
    });

    it("Should revert spending with invalid signature", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create and deposit a commitment
        const inputCommitment = {
            amount: "1000000000000000000",
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "1000000000000000000";
        const zeroCommitment1 = {
            amount: "0",
            entropy:
                "111111111111111111111111111111111111111111111111111111111111111",
        };
        const zeroCommitment2 = {
            amount: "0",
            entropy:
                "222222222222222222222222222222222222222222222222222222222222222",
        };

        const inputHash = await computePoseidon(inputCommitment);
        const hashZero1 = await computePoseidon(zeroCommitment1);
        const hashZero2 = await computePoseidon(zeroCommitment2);

        const depositInput = {
            commitments: [inputCommitment, zeroCommitment1, zeroCommitment2],
            hashes: [inputHash, hashZero1, hashZero2],
            total_amount: totalAmount,
        };

        const { witness: depositWitness } = await noir.execute(depositInput);
        const { proof: depositProof } = await backend.generateProof(
            depositWitness,
            { keccak: true }
        );

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: inputHash, owner: user1.address },
            { poseidonHash: hashZero1, owner: user2.address },
            { poseidonHash: hashZero2, owner: user3.address },
        ];

        await mockToken
            .connect(user1)
            .approve(vault.target, BigInt(totalAmount));
        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                BigInt(totalAmount),
                depositCommitmentParams,
                depositProof
            );

        // Create spend transaction
        const outputCommitment = {
            amount: "1000000000000000000", // 1 token (no fee)
            entropy:
                "987654321098765432109876543210987654321098765432109876543210987",
        };

        const outputHash = await computePoseidon(outputCommitment);
        const fee = "0"; // No fee

        const spendInput = {
            input: inputCommitment,
            output: outputCommitment,
            input_hash: inputHash,
            output_hash: outputHash,
            fee: fee,
        };

        const spendNoir = new Noir(spendCircuit as any);
        const spendBackend = new UltraHonkBackend(spendCircuit.bytecode);

        const { witness: spendWitness } = await spendNoir.execute(spendInput);
        const { proof: spendProof } = await spendBackend.generateProof(
            spendWitness,
            { keccak: true }
        );

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const transaction = {
            deadline: deadline,
            token: mockToken.target,
            inputsPoseidonHashes: [inputHash],
            outputsPoseidonHashes: [outputHash],
            inputWitnesses: [
                {
                    signature: "0x",
                    indexes: [0],
                },
            ],
            outputWitnesses: [
                {
                    owner: user2.address,
                    indexes: [0],
                },
            ],
            fee: BigInt(fee),
        };

        // Sign with wrong user (user2 instead of user1)
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const encoded = abi.encode(
            ["uint256", "address", "uint256", "uint256", "uint240", "address"],
            [
                transaction.deadline,
                transaction.token,
                transaction.inputsPoseidonHashes,
                transaction.outputsPoseidonHashes,
                transaction.outputWitnesses.map((w) => [w.owner, w.indexes]),
                transaction.fee,
            ]
        );
        const hash = ethers.keccak256(encoded);
        const signature = await user2.signMessage(ethers.getBytes(hash));
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to invalid signature
        await expect(
            vault.connect(user1).spend(transaction, spendProof)
        ).to.be.revertedWith("Vault: Invalid signature");
    });

    it("Should revert spending non-existent commitment", async function () {
        const { vault, mockToken, user1, user2 } = await useDeploymentFixture();

        // Create fake commitment hashes
        const fakeInputHash =
            "1234567890123456789012345678901234567890123456789012345678901234";
        const fakeOutputHash =
            "9876543210987654321098765432109876543210987654321098765432109876";

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const transaction = {
            deadline: deadline,
            token: mockToken.target,
            inputsPoseidonHashes: [fakeInputHash],
            outputsPoseidonHashes: [fakeOutputHash],
            inputWitnesses: [
                {
                    signature: "0x",
                    indexes: [0],
                },
            ],
            outputWitnesses: [
                {
                    owner: user2.address,
                    indexes: [0],
                },
            ],
            fee: 0n,
        };

        const encoded = abi.encode(
            ["uint256", "address", "uint256[]", "uint256[]", "tuple(address,uint8[])[]", "uint240"],
            [
                transaction.deadline,
                transaction.token,
                transaction.inputsPoseidonHashes,
                transaction.outputsPoseidonHashes,
                transaction.outputWitnesses.map((w) => [w.owner, w.indexes]),
                transaction.fee,
            ]
        );
        const hash = ethers.keccak256(encoded);
        const signature = await user1.signMessage(ethers.getBytes(hash));
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to non-existent commitment
        await expect(
            vault.connect(user1).spend(transaction, "0x")
        ).to.be.revertedWith("Vault: Input commitment not found");
    });

    it("Should revert spending with non-zero fee", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create and deposit a commitment
        const inputCommitment = {
            amount: "1000000000000000000",
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "1000000000000000000";
        const zeroCommitment1 = {
            amount: "0",
            entropy:
                "111111111111111111111111111111111111111111111111111111111111111",
        };
        const zeroCommitment2 = {
            amount: "0",
            entropy:
                "222222222222222222222222222222222222222222222222222222222222222",
        };

        const inputHash = await computePoseidon(inputCommitment);
        const hashZero1 = await computePoseidon(zeroCommitment1);
        const hashZero2 = await computePoseidon(zeroCommitment2);

        const depositInput = {
            commitments: [inputCommitment, zeroCommitment1, zeroCommitment2],
            hashes: [inputHash, hashZero1, hashZero2],
            total_amount: totalAmount,
        };

        const { witness: depositWitness } = await noir.execute(depositInput);
        const { proof: depositProof } = await backend.generateProof(
            depositWitness,
            { keccak: true }
        );

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: inputHash, owner: user1.address },
            { poseidonHash: hashZero1, owner: user2.address },
            { poseidonHash: hashZero2, owner: user3.address },
        ];

        await mockToken
            .connect(user1)
            .approve(vault.target, BigInt(totalAmount));
        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                BigInt(totalAmount),
                depositCommitmentParams,
                depositProof
            );

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const transaction = {
            deadline: deadline,
            token: mockToken.target,
            inputsPoseidonHashes: [inputHash],
            outputsPoseidonHashes: [inputHash], // Reuse input hash for simplicity
            inputWitnesses: [
                {
                    signature: "0x",
                    indexes: [0],
                },
            ],
            outputWitnesses: [
                {
                    owner: user2.address,
                    indexes: [0],
                },
            ],
            fee: 1000000000000000000n, // Non-zero fee
        };

        // Should revert due to non-zero fee
        await expect(
            vault.connect(user1).spend(transaction, "0x")
        ).to.be.revertedWith("Vault: Fee not supported yet");
    });

    it("Should revert spending with invalid token address", async function () {
        const { vault, user1, user2 } = await useDeploymentFixture();

        const fakeInputHash =
            "1234567890123456789012345678901234567890123456789012345678901234";
        const fakeOutputHash =
            "9876543210987654321098765432109876543210987654321098765432109876";

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const transaction = {
            deadline: deadline,
            token: ethers.ZeroAddress, // Invalid token address
            inputsPoseidonHashes: [fakeInputHash],
            outputsPoseidonHashes: [fakeOutputHash],
            inputWitnesses: [
                {
                    signature: "0x",
                    indexes: [0],
                },
            ],
            outputWitnesses: [
                {
                    owner: user2.address,
                    indexes: [0],
                },
            ],
            fee: 0n,
        };

        // Should revert due to invalid token address
        await expect(
            vault.connect(user1).spend(transaction, "0x")
        ).to.be.revertedWith("Vault: Invalid token address");
    });
});
