import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";

describe("Vault - Emergency Withdraw", function () {
    it("Should allow owner to emergency withdraw all tokens", async function () {
        const { vault, mockToken, owner, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create a simple deposit with ZK proof for testing
        const commitments = [
            {
                amount: "50000000000000000000", // 50 tokens
                entropy:
                    "0x123456789012345678901234567890123456789012345678901234567890123",
            },
            {
                amount: "0",
                entropy:
                    "0x345678901234567890123456789012345678901234567890123456789012345",
            },
            {
                amount: "0",
                entropy:
                    "0x456789012345678901234567890123456789012345678901234567890123456",
            },
        ];

        const totalAmount = "50000000000000000000"; // 50 tokens total

        // Compute poseidon hashes for each commitment
        const hashes = [];
        for (let i = 0; i < 3; i++) {
            hashes.push(await computePoseidon(commitments[i]));
        }

        // Create the input for the circuit
        const input = {
            commitments: commitments,
            hashes: hashes,
            total_amount: totalAmount,
        };

        // Generate the proof
        const { witness } = await noir.execute(input);
        const { proof } = await backend.generateProof(witness, {
            keccak: true,
        });

        const depositCommitmentParams: [any, any, any] = [
            {
                poseidonHash: hashes[0],
                owner: user1.address,
            },
            {
                poseidonHash: hashes[1],
                owner: user2.address,
            },
            {
                poseidonHash: hashes[2],
                owner: user3.address,
            },
        ];

        // Deposit tokens from multiple users
        const depositAmount = BigInt(totalAmount);
        await mockToken.connect(user1).approve(vault.target, depositAmount);
        await mockToken.connect(user2).approve(vault.target, depositAmount);

        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                depositAmount,
                depositCommitmentParams,
                proof
            );

        // Create another deposit for user2
        const commitments2 = [
            {
                amount: "50000000000000000000", // 50 tokens
                entropy:
                    "0x987654321098765432109876543210987654321098765432109876543210987",
            },
            {
                amount: "0",
                entropy:
                    "0x876543210987654321098765432109876543210987654321098765432109876",
            },
            {
                amount: "0",
                entropy:
                    "0x765432109876543210987654321098765432109876543210987654321098765",
            },
        ];

        const hashes2 = [];
        for (let i = 0; i < 3; i++) {
            hashes2.push(await computePoseidon(commitments2[i]));
        }

        const input2 = {
            commitments: commitments2,
            hashes: hashes2,
            total_amount: totalAmount,
        };

        const { witness: witness2 } = await noir.execute(input2);
        const { proof: proof2 } = await backend.generateProof(witness2, {
            keccak: true,
        });

        const depositCommitmentParams2: [any, any, any] = [
            {
                poseidonHash: hashes2[0],
                owner: user2.address,
            },
            {
                poseidonHash: hashes2[1],
                owner: user1.address,
            },
            {
                poseidonHash: hashes2[2],
                owner: user3.address,
            },
        ];

        await vault
            .connect(user2)
            .deposit(
                mockToken.target,
                depositAmount,
                depositCommitmentParams2,
                proof2
            );

        const initialOwnerBalance = await mockToken.balanceOf(owner.address);

        await vault.connect(owner).emergencyWithdraw(mockToken.target);

        const finalOwnerBalance = await mockToken.balanceOf(owner.address);
        expect(finalOwnerBalance).to.equal(
            initialOwnerBalance + BigInt(totalAmount) * 2n
        );
    });

    it("Should revert if called by non-owner", async function () {
        const { vault, mockToken, user1 } = await useDeploymentFixture();

        await expect(
            vault.connect(user1).emergencyWithdraw(mockToken.target)
        ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
});
