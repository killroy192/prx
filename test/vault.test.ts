import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { Vault } from "../typechain-types/contracts/Vault";
import { setupDeposit } from "./utils/vaultTestUtils";

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
});
