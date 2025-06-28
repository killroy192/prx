import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { Vault } from "../typechain-types/contracts/Vault";

describe("Vault - Integration", function () {
    it("Should successfully deposit and withdraw in sequence", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create a commitment for testing
        const commitment = {
            amount: "1000000000000000000", // 1 token
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "1000000000000000000";

        // Create zero-amount commitments
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

        // Compute poseidon hashes for all commitments
        const hash = await computePoseidon(commitment);
        const hash1 = await computePoseidon(zeroCommitment1);
        const hash2 = await computePoseidon(zeroCommitment2);

        const input = {
            commitments: [commitment, zeroCommitment1, zeroCommitment2],
            hashes: [hash, hash1, hash2],
            total_amount: totalAmount,
        };

        const { witness } = await noir.execute(input);
        const { proof } = await backend.generateProof(witness, {
            keccak: true,
        });

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: hash, owner: user1.address },
            { poseidonHash: hash1, owner: user2.address },
            { poseidonHash: hash2, owner: user3.address },
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
                proof
            );

        // Verify deposit was successful
        const [owner, spent] = await vault.getCommitment(
            mockToken.target,
            hash
        );
        expect(owner).to.equal(user1.address);
        expect(spent).to.equal(false);

        // Withdraw the commitment
        const initialUserBalance = await mockToken.balanceOf(user1.address);
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitment.amount),
                BigInt(commitment.entropy)
            );

        // Verify withdrawal was successful
        const finalUserBalance = await mockToken.balanceOf(user1.address);
        expect(finalUserBalance).to.equal(
            initialUserBalance + BigInt(commitment.amount)
        );

        // Verify commitment is deleted
        const [ownerAfter, spentAfter] = await vault.getCommitment(
            mockToken.target,
            hash
        );
        expect(ownerAfter).to.equal(ethers.ZeroAddress);
        expect(spentAfter).to.equal(false);
    });

    it("Should handle multiple deposits and withdrawals correctly", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // First deposit
        const commitment1 = {
            amount: "5000000000000000000", // 5 tokens
            entropy:
                "111111111111111111111111111111111111111111111111111111111111111",
        };

        const zeroCommitment1 = {
            amount: "0",
            entropy:
                "222222222222222222222222222222222222222222222222222222222222222",
        };
        const zeroCommitment2 = {
            amount: "0",
            entropy:
                "333333333333333333333333333333333333333333333333333333333333333",
        };

        const hash1 = await computePoseidon(commitment1);
        const hashZero1 = await computePoseidon(zeroCommitment1);
        const hashZero2 = await computePoseidon(zeroCommitment2);

        const input1 = {
            commitments: [commitment1, zeroCommitment1, zeroCommitment2],
            hashes: [hash1, hashZero1, hashZero2],
            total_amount: commitment1.amount,
        };

        const { witness: witness1 } = await noir.execute(input1);
        const { proof: proof1 } = await backend.generateProof(witness1, {
            keccak: true,
        });

        const depositParams1: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: hash1, owner: user1.address },
            { poseidonHash: hashZero1, owner: user2.address },
            { poseidonHash: hashZero2, owner: user3.address },
        ];

        await mockToken
            .connect(user1)
            .approve(vault.target, BigInt(commitment1.amount));
        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                BigInt(commitment1.amount),
                depositParams1,
                proof1
            );

        // Second deposit with different zero commitments
        const commitment2 = {
            amount: "3000000000000000000", // 3 tokens
            entropy:
                "444444444444444444444444444444444444444444444444444444444444444",
        };

        const zeroCommitment3 = {
            amount: "0",
            entropy:
                "555555555555555555555555555555555555555555555555555555555555555",
        };
        const zeroCommitment4 = {
            amount: "0",
            entropy:
                "666666666666666666666666666666666666666666666666666666666666666",
        };

        const hash2 = await computePoseidon(commitment2);
        const hashZero3 = await computePoseidon(zeroCommitment3);
        const hashZero4 = await computePoseidon(zeroCommitment4);

        const input2 = {
            commitments: [commitment2, zeroCommitment3, zeroCommitment4],
            hashes: [hash2, hashZero3, hashZero4],
            total_amount: commitment2.amount,
        };

        const { witness: witness2 } = await noir.execute(input2);
        const { proof: proof2 } = await backend.generateProof(witness2, {
            keccak: true,
        });

        const depositParams2: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            { poseidonHash: hash2, owner: user2.address },
            { poseidonHash: hashZero3, owner: user1.address },
            { poseidonHash: hashZero4, owner: user3.address },
        ];

        await mockToken
            .connect(user2)
            .approve(vault.target, BigInt(commitment2.amount));
        await vault
            .connect(user2)
            .deposit(
                mockToken.target,
                BigInt(commitment2.amount),
                depositParams2,
                proof2
            );

        // Verify both deposits exist
        const [owner1, spent1] = await vault.getCommitment(
            mockToken.target,
            hash1
        );
        const [owner2, spent2] = await vault.getCommitment(
            mockToken.target,
            hash2
        );
        expect(owner1).to.equal(user1.address);
        expect(owner2).to.equal(user2.address);
        expect(spent1).to.equal(false);
        expect(spent2).to.equal(false);

        // Withdraw first commitment
        const initialUser1Balance = await mockToken.balanceOf(user1.address);
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitment1.amount),
                BigInt(commitment1.entropy)
            );

        const finalUser1Balance = await mockToken.balanceOf(user1.address);
        expect(finalUser1Balance).to.equal(
            initialUser1Balance + BigInt(commitment1.amount)
        );

        // Verify first commitment is deleted but second still exists
        const [owner1After, spent1After] = await vault.getCommitment(
            mockToken.target,
            hash1
        );
        const [owner2After, spent2After] = await vault.getCommitment(
            mockToken.target,
            hash2
        );
        expect(owner1After).to.equal(ethers.ZeroAddress);
        expect(owner2After).to.equal(user2.address);
        expect(spent2After).to.equal(false);
    });
});
