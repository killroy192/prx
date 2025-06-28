import { expect } from "chai";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { Vault } from "../typechain-types/contracts/Vault";
import {
    makeCommitmentsWithHashes,
    setupDeposit,
} from "./utils/vaultTestUtils";

describe("Vault - Deposit", function () {
    it("Should successfully deposit with valid ZK proof using current contract logic", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Use utility to create commitments and hashes
        const amounts = [
            "1000000000000000000",
            "2000000000000000000",
            "3000000000000000000",
        ];
        const owners = [user1.address, user2.address, user3.address];
        const totalAmount = amounts
            .reduce((sum, a) => sum + BigInt(a), 0n)
            .toString();

        // Use setupDeposit utility (this already performs the deposit)
        const { commitments, hashes, proof } = await setupDeposit(
            vault,
            mockToken,
            user1,
            amounts,
            owners,
            noir,
            backend
        );

        // Verify the proof locally (optional, but kept for completeness)
        const input = {
            commitments: commitments as any,
            hashes,
            total_amount: totalAmount,
        };
        const { witness } = await noir.execute(input);
        const { proof: localProof, publicInputs } = await backend.generateProof(
            witness,
            { keccak: true }
        );
        const isValidLocal = await backend.verifyProof(
            { proof: localProof, publicInputs },
            { keccak: true }
        );
        expect(isValidLocal).to.be.true;

        // Assert that commitments are stored correctly
        for (let i = 0; i < 3; i++) {
            const [owner, spent] = await vault.getCommitment(
                mockToken.target,
                hashes[i]
            );
            expect(owner).to.equal(owners[i]);
            expect(spent).to.equal(false);
        }

        console.log("Test passed - contract logic is correct!");
    });

    it("Should compute Poseidon hash on-chain correctly", async function () {
        const { vault } = await useDeploymentFixture();

        const amount = "1000000000000000000"; // 1 token
        const entropy =
            "123456789012345678901234567890123456789012345678901234567890123";

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
