import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import spendCircuit from "../circuits/spend_11/target/spend_11.json";
import { Vault } from "../typechain-types/contracts/Vault";
import {
    makeCommitments,
    setupStandardSpend,
    createSpendTransaction,
    encodeAndSignTransaction,
    createExpiredDeadline,
    createFutureDeadline,
    generateSpendProof,
} from "./utils/vaultTestUtils";

const abi = ethers.AbiCoder.defaultAbiCoder();

describe("Vault - Spend", function () {
    it("Should successfully spend a commitment (1-to-1 transaction)", async function () {
        const { vault, mockToken, user1, user2, noir, backend } =
            await useDeploymentFixture();

        // Setup standard spend using utility
        const {
            inputCommitment,
            outputCommitment,
            inputHash,
            outputHash,
            transaction,
            proof,
        } = await setupStandardSpend(
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
        const {
            inputCommitment,
            outputCommitment,
            inputHash,
            outputHash,
            transaction,
            proof,
        } = await setupStandardSpend(
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
        const {
            inputCommitment,
            outputCommitment,
            inputHash,
            outputHash,
            transaction,
            proof,
        } = await setupStandardSpend(
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
        const {
            inputCommitment,
            outputCommitment,
            inputHash,
            outputHash,
            transaction,
            proof,
        } = await setupStandardSpend(
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

    it("Should have Spend12Verifier properly integrated", async function () {
        const { vault, spend12Verifier } = await useDeploymentFixture();

        // Verify that the Spend12Verifier is properly set in the Vault
        expect(await vault.spend12Verifier()).to.equal(spend12Verifier.target);
    });
});
