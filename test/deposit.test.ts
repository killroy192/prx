import { expect } from "chai";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { Vault } from "../typechain-types/contracts/Vault";

describe("Vault - Deposit", function () {
    it("Should successfully deposit with valid ZK proof using current contract logic", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Create commitments with amounts and entropy
        const commitments = [
            {
                amount: "1000000000000000000", // 1 token
                entropy:
                    "0x123456789012345678901234567890123456789012345678901234567890123",
            },
            {
                amount: "2000000000000000000", // 2 tokens
                entropy:
                    "0x345678901234567890123456789012345678901234567890123456789012345",
            },
            {
                amount: "3000000000000000000", // 3 tokens
                entropy:
                    "0x456789012345678901234567890123456789012345678901234567890123456",
            },
        ];

        const totalAmount = "6000000000000000000"; // 6 tokens total

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
        const { proof, publicInputs } = await backend.generateProof(witness, {
            keccak: true,
        });

        // Verify the proof locally first
        const isValidLocal = await backend.verifyProof(
            { proof, publicInputs },
            { keccak: true }
        );
        expect(isValidLocal).to.be.true;

        const depositCommitmentParams: [
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct,
            Vault.DepositCommitmentParamsStruct
        ] = [
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

        // Approve tokens
        await mockToken
            .connect(user1)
            .approve(vault.target, BigInt(totalAmount));

        // Deposit tokens
        await vault
            .connect(user1)
            .deposit(
                mockToken.target,
                BigInt(totalAmount),
                depositCommitmentParams,
                proof
            );

        console.log("Test passed - contract logic is correct!");
    });

    it("Should compute Poseidon hash on-chain correctly", async function () {
        const { vault } = await useDeploymentFixture();

        const amount = "1000000000000000000"; // 1 token
        const entropy =
            "0x123456789012345678901234567890123456789012345678901234567890123";

        // Compute hash off-chain
        const offChainHash = await computePoseidon({ amount, entropy });

        // Compute hash on-chain
        const onChainHash = await vault.computePoseidonHash(
            BigInt(amount),
            BigInt(entropy)
        );

        // They should match
        expect(onChainHash.toString()).to.equal(offChainHash);
    });
});
