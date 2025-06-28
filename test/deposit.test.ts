import { expect } from "chai";
import { useDeploymentFixture } from "./fixtures/deployment";
import { computePoseidon } from "../utils/poseidon";
import { setupDeposit } from "./utils/vaultTestUtils";

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

        // Use setupDeposit utility (this already performs the deposit)
        const { hashes } = await setupDeposit(
            vault,
            mockToken,
            user1,
            amounts,
            owners,
            noir,
            backend
        );

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
