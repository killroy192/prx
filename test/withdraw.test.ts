import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { Vault } from "../typechain-types/contracts/Vault";

describe("Vault - Withdraw", function () {
    it("Should successfully withdraw a commitment", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create a commitment for withdrawal testing
        const commitment = {
            amount: "5000000000000000000", // 5 tokens
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "5000000000000000000"; // 5 tokens total

        // Create zero-amount commitments
        const zeroCommitment1 = {
            amount: "0",
            entropy:
                "345678901234567890123456789012345678901234567890123456789012345",
        };
        const zeroCommitment2 = {
            amount: "0",
            entropy:
                "456789012345678901234567890123456789012345678901234567890123456",
        };

        // Compute poseidon hashes for all commitments
        const hash = await computePoseidon(commitment);
        const hash1 = await computePoseidon(zeroCommitment1);
        const hash2 = await computePoseidon(zeroCommitment2);

        // Create the input for the circuit
        const input = {
            commitments: [commitment, zeroCommitment1, zeroCommitment2],
            hashes: [hash, hash1, hash2],
            total_amount: totalAmount,
        };

        // Generate the proof
        const { witness } = await noir.execute(input);
        const { proof } = await backend.generateProof(witness, {
            keccak: true,
        });

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
            {
                poseidonHash: hash,
                owner: user1.address,
            },
            {
                poseidonHash: hash1,
                owner: user2.address,
            },
            {
                poseidonHash: hash2,
                owner: user3.address,
            },
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

        // Check initial balances
        const initialVaultBalance = await mockToken.balanceOf(vault.target);
        const initialUserBalance = await mockToken.balanceOf(user1.address);

        // Withdraw the commitment
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitment.amount),
                BigInt(commitment.entropy)
            );

        // Check final balances
        const finalVaultBalance = await mockToken.balanceOf(vault.target);
        const finalUserBalance = await mockToken.balanceOf(user1.address);

        // Verify balances
        expect(finalVaultBalance).to.equal(
            initialVaultBalance - BigInt(commitment.amount)
        );
        expect(finalUserBalance).to.equal(
            initialUserBalance + BigInt(commitment.amount)
        );

        // Verify commitment is deleted from storage
        const [owner, spent] = await vault.getCommitment(
            mockToken.target,
            hash
        );
        expect(owner).to.equal(ethers.ZeroAddress);
        expect(spent).to.equal(false); // Default value for non-existent commitment
    });

    it("Should revert withdrawal by unauthorized address", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create and deposit a commitment
        const commitment = {
            amount: "3000000000000000000", // 3 tokens
            entropy:
                "987654321098765432109876543210987654321098765432109876543210987",
        };

        const totalAmount = "3000000000000000000";

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

        // Try to withdraw with wrong address
        await expect(
            vault
                .connect(user2)
                .withdraw(
                    mockToken.target,
                    BigInt(commitment.amount),
                    BigInt(commitment.entropy)
                )
        ).to.be.revertedWith("Vault: Only assigned address can withdraw");
    });

    it("Should revert withdrawal of non-existent commitment", async function () {
        const { vault, mockToken, user1 } = await useDeploymentFixture();

        const fakeAmount = "1000000000000000000";
        const fakeEntropy =
            "123456789012345678901234567890123456789012345678901234567890123";

        await expect(
            vault
                .connect(user1)
                .withdraw(
                    mockToken.target,
                    BigInt(fakeAmount),
                    BigInt(fakeEntropy)
                )
        ).to.be.revertedWith("Vault: Commitment not found");
    });

    it("Should revert withdrawal with zero amount", async function () {
        const { vault, mockToken, user1 } = await useDeploymentFixture();

        await expect(
            vault
                .connect(user1)
                .withdraw(
                    mockToken.target,
                    0,
                    BigInt(
                        "123456789012345678901234567890123456789012345678901234567890123"
                    )
                )
        ).to.be.revertedWith("Vault: Amount must be greater than 0");
    });

    it("Should revert withdrawal with invalid token address", async function () {
        const { vault, user1 } = await useDeploymentFixture();

        await expect(
            vault
                .connect(user1)
                .withdraw(
                    ethers.ZeroAddress,
                    BigInt("1000000000000000000"),
                    BigInt(
                        "123456789012345678901234567890123456789012345678901234567890123"
                    )
                )
        ).to.be.revertedWith("Vault: Invalid token address");
    });

    it("Should prevent double withdrawal of the same commitment", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create and deposit a commitment
        const commitment = {
            amount: "2000000000000000000", // 2 tokens
            entropy:
                "123456789012345678901234567890123456789012345678901234567890123",
        };

        const totalAmount = "2000000000000000000";

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

        // First withdrawal should succeed
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitment.amount),
                BigInt(commitment.entropy)
            );

        // Second withdrawal should fail (commitment deleted)
        await expect(
            vault
                .connect(user1)
                .withdraw(
                    mockToken.target,
                    BigInt(commitment.amount),
                    BigInt(commitment.entropy)
                )
        ).to.be.revertedWith("Vault: Commitment not found");
    });
});
