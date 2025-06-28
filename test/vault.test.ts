import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import {
    setupDeposit,
    makeCommitments,
    encodeAndSignTransaction,
    createFutureDeadline,
} from "./utils/vaultTestUtils";
import { computePoseidon } from "../utils/poseidon";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import spendCircuit from "../circuits/spend_11/target/spend_11.json";

describe("Vault - Integration", function () {
    it("Should successfully deposit and withdraw in sequence", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Use utility to setup deposit
        const amounts = ["1000000000000000000", "0", "0"];
        const owners = [user1.address, user2.address, user3.address];
        const { commitments, hashes } = await setupDeposit(
            vault,
            mockToken,
            user1,
            amounts,
            owners,
            noir,
            backend
        );

        // Verify deposit was successful
        const [owner, spent] = await vault.getCommitment(
            mockToken.target,
            hashes[0]
        );
        expect(owner).to.equal(user1.address);
        expect(spent).to.equal(false);

        // Withdraw the commitment
        const initialUserBalance = await mockToken.balanceOf(user1.address);
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitments[0].amount),
                BigInt(commitments[0].entropy)
            );

        // Verify withdrawal was successful
        const finalUserBalance = await mockToken.balanceOf(user1.address);
        expect(finalUserBalance).to.equal(
            initialUserBalance + BigInt(commitments[0].amount)
        );

        // Verify commitment is deleted
        const [ownerAfter, spentAfter] = await vault.getCommitment(
            mockToken.target,
            hashes[0]
        );
        expect(ownerAfter).to.equal(ethers.ZeroAddress);
        expect(spentAfter).to.equal(false);
    });

    it("Should handle multiple deposits and withdrawals correctly", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // First deposit
        const amounts1 = ["5000000000000000000", "0", "0"];
        const owners1 = [user1.address, user2.address, user3.address];
        const { commitments: commitments1, hashes: hashes1 } =
            await setupDeposit(
                vault,
                mockToken,
                user1,
                amounts1,
                owners1,
                noir,
                backend
            );

        // Second deposit
        const amounts2 = ["3000000000000000000", "0", "0"];
        const owners2 = [user2.address, user1.address, user3.address];
        const { commitments: commitments2, hashes: hashes2 } =
            await setupDeposit(
                vault,
                mockToken,
                user2,
                amounts2,
                owners2,
                noir,
                backend
            );

        // Withdraw from first deposit
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitments1[0].amount),
                BigInt(commitments1[0].entropy)
            );

        // Withdraw from second deposit
        await vault
            .connect(user2)
            .withdraw(
                mockToken.target,
                BigInt(commitments2[0].amount),
                BigInt(commitments2[0].entropy)
            );

        // Verify commitments are deleted
        const [owner1, spent1] = await vault.getCommitment(
            mockToken.target,
            hashes1[0]
        );
        expect(owner1).to.equal(ethers.ZeroAddress);
        expect(spent1).to.equal(false);

        const [owner2, spent2] = await vault.getCommitment(
            mockToken.target,
            hashes2[0]
        );
        expect(owner2).to.equal(ethers.ZeroAddress);
        expect(spent2).to.equal(false);
    });

    it("Should handle complete flow: deposit → spend → withdraw", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Step 1: User1 deposits tokens
        const amounts = ["2000000000000000000", "0", "0"]; // 2 tokens
        const owners = [user1.address, user2.address, user3.address];
        const { commitments, hashes } = await setupDeposit(
            vault,
            mockToken,
            user1,
            amounts,
            owners,
            noir,
            backend
        );

        // Verify deposit was successful
        const [owner, spent] = await vault.getCommitment(
            mockToken.target,
            hashes[0]
        );
        expect(owner).to.equal(user1.address);
        expect(spent).to.equal(false);

        // Step 2: User1 spends the commitment to User2
        const [outputCommitment] = makeCommitments(["2000000000000000000"]);
        const outputHash = await computePoseidon(outputCommitment);

        // Create transaction
        const deadline = createFutureDeadline();
        const transaction = {
            deadline,
            token: mockToken.target.toString(),
            inputsPoseidonHashes: [hashes[0]],
            outputsPoseidonHashes: [outputHash],
            inputWitnesses: [{ signature: "0x", indexes: [0] }],
            outputWitnesses: [{ owner: user2.address, indexes: [0] }],
            fee: 0n,
        };

        // Sign the transaction
        const signature = await encodeAndSignTransaction(transaction, user1);
        transaction.inputWitnesses[0].signature = signature;

        // Generate proof for 1-to-1 spend
        const spendNoir = new Noir(spendCircuit as any);
        const spendBackend = new UltraHonkBackend(spendCircuit.bytecode);
        const spendInput = {
            input: { ...commitments[0] },
            output: { ...outputCommitment },
            input_hash: hashes[0],
            output_hash: outputHash,
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
            hashes[0]
        );
        expect(inputOwner).to.equal(ethers.ZeroAddress);
        expect(inputSpent).to.equal(false);

        // Verify the output commitment is created and owned by user2
        const [outputOwner, outputSpent] = await vault.getCommitment(
            mockToken.target,
            outputHash
        );
        expect(outputOwner).to.equal(user2.address);
        expect(outputSpent).to.equal(false);

        // Step 3: User2 withdraws the received commitment
        const initialUser2Balance = await mockToken.balanceOf(user2.address);
        await vault
            .connect(user2)
            .withdraw(
                mockToken.target,
                BigInt(outputCommitment.amount),
                BigInt(outputCommitment.entropy)
            );

        // Verify withdrawal was successful
        const finalUser2Balance = await mockToken.balanceOf(user2.address);
        expect(finalUser2Balance).to.equal(
            initialUser2Balance + BigInt(outputCommitment.amount)
        );

        // Verify the output commitment is deleted after withdrawal
        const [outputOwnerAfter, outputSpentAfter] = await vault.getCommitment(
            mockToken.target,
            outputHash
        );
        expect(outputOwnerAfter).to.equal(ethers.ZeroAddress);
        expect(outputSpentAfter).to.equal(false);

        // Verify the total token flow is correct
        // User1 should have spent 2 tokens (deposit)
        // User2 should have received 2 tokens (withdrawal)
        const user1Balance = await mockToken.balanceOf(user1.address);
        const user2Balance = await mockToken.balanceOf(user2.address);
        const vaultBalance = await mockToken.balanceOf(vault.target);

        // User1's balance should be reduced by the deposit amount
        expect(user1Balance).to.be.lt(ethers.parseEther("1000000")); // Assuming user1 started with 1M tokens

        // User2 should have received the full amount
        expect(user2Balance).to.equal(
            initialUser2Balance + BigInt(outputCommitment.amount)
        );

        // Vault should have 0 balance (all tokens were withdrawn)
        expect(vaultBalance).to.equal(0n);
    });
});
