import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import spendCircuit from "../circuits/spend_11/target/spend_11.json";
import spend12Circuit from "../circuits/spend_12/target/spend_12.json";
import spend13Circuit from "../circuits/spend_13/target/spend_13.json";
import spend21Circuit from "../circuits/spend_21/target/spend_21.json";
import spend22Circuit from "../circuits/spend_22/target/spend_22.json";
import spend23Circuit from "../circuits/spend_23/target/spend_23.json";
import spend31Circuit from "../circuits/spend_31/target/spend_31.json";
import spend32Circuit from "../circuits/spend_32/target/spend_32.json";
import {
    makeCommitments,
    setupStandardSpend,
    setupDeposit,
    createSpendTransaction,
    encodeAndSignTransaction,
    createExpiredDeadline,
    createFutureDeadline,
} from "./utils/vaultTestUtils";

const abi = ethers.AbiCoder.defaultAbiCoder();

describe("Vault - Spend", function () {
    it("Should successfully spend a commitment (1-to-1 transaction)", async function () {
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup standard spend using utility
        const { inputHash, outputHash, transaction, proof } =
            await setupStandardSpend(
                vault,
                mockToken,
                user1,
                user2,
                noir,
                backend,
                spendCircuit
            );

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

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
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup standard spend
        const { transaction, proof } = await setupStandardSpend(
            vault,
            mockToken,
            user1,
            user2,
            noir,
            backend,
            spendCircuit
        );

        // Override with expired deadline
        transaction.deadline = createExpiredDeadline();

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to expired deadline
        await expect(
            vault.connect(user1).spend(transaction, proof)
        ).to.be.revertedWith("Vault: Transaction expired");
    });

    it("Should revert spending with invalid signature", async function () {
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup standard spend
        const { transaction, proof } = await setupStandardSpend(
            vault,
            mockToken,
            user1,
            user2,
            noir,
            backend,
            spendCircuit
        );

        // Sign with wrong user (user2 instead of user1)
        const signature = await encodeAndSignTransaction(transaction, user2);
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to invalid signature
        await expect(
            vault.connect(user1).spend(transaction, proof)
        ).to.be.revertedWith("Vault: Invalid signature");
    });

    it("Should revert spending non-existent commitment", async function () {
        const { vault, mockToken, user1, user2 } = await useDeploymentFixture();

        // Create fake commitment hashes
        const fakeInputHash =
            "1234567890123456789012345678901234567890123456789012345678901234";
        const fakeOutputHash =
            "9876543210987654321098765432109876543210987654321098765432109876";

        const deadline = createFutureDeadline();
        const transaction = createSpendTransaction(
            fakeInputHash,
            fakeOutputHash,
            user2.address,
            deadline,
            mockToken.target.toString()
        );

        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to non-existent commitment
        await expect(
            vault.connect(user1).spend(transaction, "0x")
        ).to.be.revertedWith("Vault: Input commitment not found");
    });

    it("Should revert spending with non-zero fee", async function () {
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup standard spend
        const { transaction, proof } = await setupStandardSpend(
            vault,
            mockToken,
            user1,
            user2,
            noir,
            backend,
            spendCircuit
        );

        // Override with non-zero fee
        transaction.fee = 1000n;

        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to non-zero fee
        await expect(
            vault.connect(user1).spend(transaction, proof)
        ).to.be.revertedWith("Vault: Fee not supported yet");
    });

    it("Should revert spending with invalid token address", async function () {
        const { vault, user1, user2 } = await useDeploymentFixture();

        // Create fake commitment hashes
        const fakeInputHash =
            "1234567890123456789012345678901234567890123456789012345678901234";
        const fakeOutputHash =
            "9876543210987654321098765432109876543210987654321098765432109876";

        const deadline = createFutureDeadline();
        const transaction = createSpendTransaction(
            fakeInputHash,
            fakeOutputHash,
            user2.address,
            deadline,
            ethers.ZeroAddress
        );

        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Should revert due to invalid token address
        await expect(
            vault.connect(user1).spend(transaction, "0x")
        ).to.be.revertedWith("Vault: Invalid token address");
    });

    it("Should successfully spend a commitment (1-to-2 transaction)", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1
        const {
            commitments: [inputCommitment],
            hashes: [inputHash],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            ["2000000000000000000", "0", "0"],
            [user1.address, user2.address, user2.address],
            noir,
            backend
        );

        // Create output commitments
        const [outputCommitment1, outputCommitment2] = makeCommitments([
            "1000000000000000000",
            "1000000000000000000",
        ]);
        const outputHash1 = await computePoseidon(outputCommitment1);
        const outputHash2 = await computePoseidon(outputCommitment2);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash],
            outputsPoseidonHashes: [outputHash1, outputHash2],
            inputWitnesses: [{ signature: "0x", indexes: [0] }],
            outputWitnesses: [
                { owner: user2.address, indexes: [0] },
                { owner: user3.address, indexes: [1] },
            ],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 1-to-2
        const spendNoir = new Noir(spend12Circuit as any);
        const spendBackend = new UltraHonkBackend(spend12Circuit.bytecode);
        const spendInput = {
            input: { ...inputCommitment },
            outputs: [{ ...outputCommitment1 }, { ...outputCommitment2 }],
            input_hash: inputHash,
            output_hashes: [outputHash1, outputHash2],
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitment is deleted
        const [inputOwner, inputSpent] = await vault.getCommitment(
            mockToken.target,
            inputHash
        );
        expect(inputOwner).to.equal(ethers.ZeroAddress);
        expect(inputSpent).to.equal(false);

        // Verify the output commitments are created
        const [outputOwner1, outputSpent1] = await vault.getCommitment(
            mockToken.target,
            outputHash1
        );
        expect(outputOwner1).to.equal(user2.address);
        expect(outputSpent1).to.equal(false);

        const [outputOwner2, outputSpent2] = await vault.getCommitment(
            mockToken.target,
            outputHash2
        );
        expect(outputOwner2).to.equal(user3.address);
        expect(outputSpent2).to.equal(false);
    });

    it("Should successfully spend a commitment (1-to-3 transaction)", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1
        const {
            commitments: [inputCommitment],
            hashes: [inputHash],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            ["3000000000000000000", "0", "0"],
            [user1.address, user2.address, user2.address],
            noir,
            backend
        );

        // Create output commitments
        const [outputCommitment1, outputCommitment2, outputCommitment3] =
            makeCommitments([
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]);
        const outputHash1 = await computePoseidon(outputCommitment1);
        const outputHash2 = await computePoseidon(outputCommitment2);
        const outputHash3 = await computePoseidon(outputCommitment3);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash],
            outputsPoseidonHashes: [outputHash1, outputHash2, outputHash3],
            inputWitnesses: [{ signature: "0x", indexes: [0] }],
            outputWitnesses: [
                { owner: user1.address, indexes: [0] },
                { owner: user2.address, indexes: [1] },
                { owner: user3.address, indexes: [2] },
            ],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 1-to-3
        const spendNoir = new Noir(spend13Circuit as any);
        const spendBackend = new UltraHonkBackend(spend13Circuit.bytecode);
        const spendInput = {
            input: { ...inputCommitment },
            outputs: [
                { ...outputCommitment1 },
                { ...outputCommitment2 },
                { ...outputCommitment3 },
            ],
            input_hash: inputHash,
            output_hashes: [outputHash1, outputHash2, outputHash3],
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitment is deleted
        const [inputOwner, inputSpent] = await vault.getCommitment(
            mockToken.target,
            inputHash
        );
        expect(inputOwner).to.equal(ethers.ZeroAddress);
        expect(inputSpent).to.equal(false);

        // Verify the output commitments are created
        const [outputOwner1, outputSpent1] = await vault.getCommitment(
            mockToken.target,
            outputHash1
        );
        expect(outputOwner1).to.equal(user1.address);
        expect(outputSpent1).to.equal(false);

        const [outputOwner2, outputSpent2] = await vault.getCommitment(
            mockToken.target,
            outputHash2
        );
        expect(outputOwner2).to.equal(user2.address);
        expect(outputSpent2).to.equal(false);

        const [outputOwner3, outputSpent3] = await vault.getCommitment(
            mockToken.target,
            outputHash3
        );
        expect(outputOwner3).to.equal(user3.address);
        expect(outputSpent3).to.equal(false);
    });

    it("Should successfully spend commitments (2-to-1 transaction)", async function () {
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1 with 2 commitments
        const {
            commitments: [inputCommitment1, inputCommitment2],
            hashes: [inputHash1, inputHash2],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            ["1000000000000000000", "1000000000000000000", "0"],
            [user1.address, user1.address, user2.address],
            noir,
            backend
        );

        // Create output commitment
        const [outputCommitment] = makeCommitments(["2000000000000000000"]);
        const outputHash = await computePoseidon(outputCommitment);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash1, inputHash2],
            outputsPoseidonHashes: [outputHash],
            inputWitnesses: [{ signature: "0x", indexes: [0, 1] }],
            outputWitnesses: [{ owner: user2.address, indexes: [0] }],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 2-to-1
        const spendNoir = new Noir(spend21Circuit as any);
        const spendBackend = new UltraHonkBackend(spend21Circuit.bytecode);
        const spendInput = {
            inputs: [{ ...inputCommitment1 }, { ...inputCommitment2 }],
            output: { ...outputCommitment },
            input_hashes: [inputHash1, inputHash2],
            output_hash: outputHash,
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitments are deleted
        const [inputOwner1, inputSpent1] = await vault.getCommitment(
            mockToken.target,
            inputHash1
        );
        expect(inputOwner1).to.equal(ethers.ZeroAddress);
        expect(inputSpent1).to.equal(false);

        const [inputOwner2, inputSpent2] = await vault.getCommitment(
            mockToken.target,
            inputHash2
        );
        expect(inputOwner2).to.equal(ethers.ZeroAddress);
        expect(inputSpent2).to.equal(false);

        // Verify the output commitment is created
        const [outputOwner, outputSpent] = await vault.getCommitment(
            mockToken.target,
            outputHash
        );
        expect(outputOwner).to.equal(user2.address);
        expect(outputSpent).to.equal(false);
    });

    it("Should successfully spend commitments (2-to-2 transaction)", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1 with 2 commitments
        const {
            commitments: [inputCommitment1, inputCommitment2],
            hashes: [inputHash1, inputHash2],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            ["1000000000000000000", "1000000000000000000", "0"],
            [user1.address, user1.address, user2.address],
            noir,
            backend
        );

        // Create output commitments
        const [outputCommitment1, outputCommitment2] = makeCommitments([
            "1000000000000000000",
            "1000000000000000000",
        ]);
        const outputHash1 = await computePoseidon(outputCommitment1);
        const outputHash2 = await computePoseidon(outputCommitment2);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash1, inputHash2],
            outputsPoseidonHashes: [outputHash1, outputHash2],
            inputWitnesses: [{ signature: "0x", indexes: [0, 1] }],
            outputWitnesses: [
                { owner: user2.address, indexes: [0] },
                { owner: user3.address, indexes: [1] },
            ],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 2-to-2
        const spendNoir = new Noir(spend22Circuit as any);
        const spendBackend = new UltraHonkBackend(spend22Circuit.bytecode);
        const spendInput = {
            inputs: [{ ...inputCommitment1 }, { ...inputCommitment2 }],
            outputs: [{ ...outputCommitment1 }, { ...outputCommitment2 }],
            input_hashes: [inputHash1, inputHash2],
            output_hashes: [outputHash1, outputHash2],
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitments are deleted
        const [inputOwner1, inputSpent1] = await vault.getCommitment(
            mockToken.target,
            inputHash1
        );
        expect(inputOwner1).to.equal(ethers.ZeroAddress);
        expect(inputSpent1).to.equal(false);

        const [inputOwner2, inputSpent2] = await vault.getCommitment(
            mockToken.target,
            inputHash2
        );
        expect(inputOwner2).to.equal(ethers.ZeroAddress);
        expect(inputSpent2).to.equal(false);

        // Verify the output commitments are created
        const [outputOwner1, outputSpent1] = await vault.getCommitment(
            mockToken.target,
            outputHash1
        );
        expect(outputOwner1).to.equal(user2.address);
        expect(outputSpent1).to.equal(false);

        const [outputOwner2, outputSpent2] = await vault.getCommitment(
            mockToken.target,
            outputHash2
        );
        expect(outputOwner2).to.equal(user3.address);
        expect(outputSpent2).to.equal(false);
    });

    it("Should successfully spend commitments (2-to-3 transaction)", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1 with 2 commitments
        const {
            commitments: [inputCommitment1, inputCommitment2],
            hashes: [inputHash1, inputHash2],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            ["1500000000000000000", "1500000000000000000", "0"],
            [user1.address, user1.address, user2.address],
            noir,
            backend
        );

        // Create output commitments
        const [outputCommitment1, outputCommitment2, outputCommitment3] =
            makeCommitments([
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]);
        const outputHash1 = await computePoseidon(outputCommitment1);
        const outputHash2 = await computePoseidon(outputCommitment2);
        const outputHash3 = await computePoseidon(outputCommitment3);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash1, inputHash2],
            outputsPoseidonHashes: [outputHash1, outputHash2, outputHash3],
            inputWitnesses: [{ signature: "0x", indexes: [0, 1] }],
            outputWitnesses: [
                { owner: user1.address, indexes: [0] },
                { owner: user2.address, indexes: [1] },
                { owner: user3.address, indexes: [2] },
            ],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 2-to-3
        const spendNoir = new Noir(spend23Circuit as any);
        const spendBackend = new UltraHonkBackend(spend23Circuit.bytecode);
        const spendInput = {
            inputs: [{ ...inputCommitment1 }, { ...inputCommitment2 }],
            outputs: [
                { ...outputCommitment1 },
                { ...outputCommitment2 },
                { ...outputCommitment3 },
            ],
            input_hashes: [inputHash1, inputHash2],
            output_hashes: [outputHash1, outputHash2, outputHash3],
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitments are deleted
        const [inputOwner1, inputSpent1] = await vault.getCommitment(
            mockToken.target,
            inputHash1
        );
        expect(inputOwner1).to.equal(ethers.ZeroAddress);
        expect(inputSpent1).to.equal(false);

        const [inputOwner2, inputSpent2] = await vault.getCommitment(
            mockToken.target,
            inputHash2
        );
        expect(inputOwner2).to.equal(ethers.ZeroAddress);
        expect(inputSpent2).to.equal(false);

        // Verify the output commitments are created
        const [outputOwner1, outputSpent1] = await vault.getCommitment(
            mockToken.target,
            outputHash1
        );
        expect(outputOwner1).to.equal(user1.address);
        expect(outputSpent1).to.equal(false);

        const [outputOwner2, outputSpent2] = await vault.getCommitment(
            mockToken.target,
            outputHash2
        );
        expect(outputOwner2).to.equal(user2.address);
        expect(outputSpent2).to.equal(false);

        const [outputOwner3, outputSpent3] = await vault.getCommitment(
            mockToken.target,
            outputHash3
        );
        expect(outputOwner3).to.equal(user3.address);
        expect(outputSpent3).to.equal(false);
    });

    it("Should successfully spend commitments (3-to-1 transaction)", async function () {
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1 with 3 commitments
        const {
            commitments: [inputCommitment1, inputCommitment2, inputCommitment3],
            hashes: [inputHash1, inputHash2, inputHash3],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ],
            [user1.address, user1.address, user1.address],
            noir,
            backend
        );

        // Create output commitment
        const [outputCommitment] = makeCommitments(["3000000000000000000"]);
        const outputHash = await computePoseidon(outputCommitment);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash1, inputHash2, inputHash3],
            outputsPoseidonHashes: [outputHash],
            inputWitnesses: [{ signature: "0x", indexes: [0, 1, 2] }],
            outputWitnesses: [{ owner: user2.address, indexes: [0] }],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 3-to-1
        const spendNoir = new Noir(spend31Circuit as any);
        const spendBackend = new UltraHonkBackend(spend31Circuit.bytecode);
        const spendInput = {
            inputs: [
                { ...inputCommitment1 },
                { ...inputCommitment2 },
                { ...inputCommitment3 },
            ],
            output: { ...outputCommitment },
            input_hashes: [inputHash1, inputHash2, inputHash3],
            output_hash: outputHash,
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitments are deleted
        const [inputOwner1, inputSpent1] = await vault.getCommitment(
            mockToken.target,
            inputHash1
        );
        expect(inputOwner1).to.equal(ethers.ZeroAddress);
        expect(inputSpent1).to.equal(false);

        const [inputOwner2, inputSpent2] = await vault.getCommitment(
            mockToken.target,
            inputHash2
        );
        expect(inputOwner2).to.equal(ethers.ZeroAddress);
        expect(inputSpent2).to.equal(false);

        const [inputOwner3, inputSpent3] = await vault.getCommitment(
            mockToken.target,
            inputHash3
        );
        expect(inputOwner3).to.equal(ethers.ZeroAddress);
        expect(inputSpent3).to.equal(false);

        // Verify the output commitment is created
        const [outputOwner, outputSpent] = await vault.getCommitment(
            mockToken.target,
            outputHash
        );
        expect(outputOwner).to.equal(user2.address);
        expect(outputSpent).to.equal(false);
    });

    it("Should successfully spend commitments (3-to-2 transaction)", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Setup deposit for user1 with 3 commitments
        const {
            commitments: [inputCommitment1, inputCommitment2, inputCommitment3],
            hashes: [inputHash1, inputHash2, inputHash3],
        } = await setupDeposit(
            vault,
            mockToken,
            user1,
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ],
            [user1.address, user1.address, user1.address],
            noir,
            backend
        );

        // Create output commitments
        const [outputCommitment1, outputCommitment2] = makeCommitments([
            "1500000000000000000",
            "1500000000000000000",
        ]);
        const outputHash1 = await computePoseidon(outputCommitment1);
        const outputHash2 = await computePoseidon(outputCommitment2);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [inputHash1, inputHash2, inputHash3],
            outputsPoseidonHashes: [outputHash1, outputHash2],
            inputWitnesses: [{ signature: "0x", indexes: [0, 1, 2] }],
            outputWitnesses: [
                { owner: user2.address, indexes: [0] },
                { owner: user3.address, indexes: [1] },
            ],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 3-to-2
        const spendNoir = new Noir(spend32Circuit as any);
        const spendBackend = new UltraHonkBackend(spend32Circuit.bytecode);
        const spendInput = {
            inputs: [
                { ...inputCommitment1 },
                { ...inputCommitment2 },
                { ...inputCommitment3 },
            ],
            outputs: [{ ...outputCommitment1 }, { ...outputCommitment2 }],
            input_hashes: [inputHash1, inputHash2, inputHash3],
            output_hashes: [outputHash1, outputHash2],
            fee: "0",
        };
        const { witness } = await spendNoir.execute(spendInput);
        const { proof } = await spendBackend.generateProof(witness, {
            keccak: true,
        });

        // Execute the spend transaction
        await vault.connect(user1).spend(transaction, proof);

        // Verify the input commitments are deleted
        const [inputOwner1, inputSpent1] = await vault.getCommitment(
            mockToken.target,
            inputHash1
        );
        expect(inputOwner1).to.equal(ethers.ZeroAddress);
        expect(inputSpent1).to.equal(false);

        const [inputOwner2, inputSpent2] = await vault.getCommitment(
            mockToken.target,
            inputHash2
        );
        expect(inputOwner2).to.equal(ethers.ZeroAddress);
        expect(inputSpent2).to.equal(false);

        const [inputOwner3, inputSpent3] = await vault.getCommitment(
            mockToken.target,
            inputHash3
        );
        expect(inputOwner3).to.equal(ethers.ZeroAddress);
        expect(inputSpent3).to.equal(false);

        // Verify the output commitments are created
        const [outputOwner1, outputSpent1] = await vault.getCommitment(
            mockToken.target,
            outputHash1
        );
        expect(outputOwner1).to.equal(user2.address);
        expect(outputSpent1).to.equal(false);

        const [outputOwner2, outputSpent2] = await vault.getCommitment(
            mockToken.target,
            outputHash2
        );
        expect(outputOwner2).to.equal(user3.address);
        expect(outputSpent2).to.equal(false);
    });
});
