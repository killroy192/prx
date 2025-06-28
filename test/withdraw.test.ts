import { expect } from "chai";
import { ethers } from "hardhat";
import { useDeploymentFixture } from "./fixtures/deployment";
import { setupDeposit } from "./utils/vaultTestUtils";

describe("Vault - Withdraw", function () {
    it("Should successfully withdraw a commitment", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Use utility to setup deposit
        const amounts = ["5000000000000000000", "0", "0"];
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

        // Check initial balances
        const initialVaultBalance = await mockToken.balanceOf(vault.target);
        const initialUserBalance = await mockToken.balanceOf(user1.address);

        // Withdraw the commitment
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitments[0].amount),
                BigInt(commitments[0].entropy)
            );

        // Check final balances
        const finalVaultBalance = await mockToken.balanceOf(vault.target);
        const finalUserBalance = await mockToken.balanceOf(user1.address);

        // Verify balances
        expect(finalVaultBalance).to.equal(
            initialVaultBalance - BigInt(commitments[0].amount)
        );
        expect(finalUserBalance).to.equal(
            initialUserBalance + BigInt(commitments[0].amount)
        );

        // Verify commitment is deleted from storage
        const [owner, spent] = await vault.getCommitment(
            mockToken.target,
            hashes[0]
        );
        expect(owner).to.equal(ethers.ZeroAddress);
        expect(spent).to.equal(false); // Default value for non-existent commitment
    });

    it("Should revert withdrawal by unauthorized address", async function () {
        const { vault, mockToken, user1, user2, user3, noir, backend } =
            await useDeploymentFixture();

        // Use utility to setup deposit
        const amounts = ["3000000000000000000", "0", "0"];
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

        // Try to withdraw with wrong address
        await expect(
            vault
                .connect(user2)
                .withdraw(
                    mockToken.target,
                    BigInt(commitments[0].amount),
                    BigInt(commitments[0].entropy)
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

        const fakeEntropy =
            "123456789012345678901234567890123456789012345678901234567890123";

        await expect(
            vault
                .connect(user1)
                .withdraw(mockToken.target, 0, BigInt(fakeEntropy))
        ).to.be.revertedWith("Vault: Amount must be greater than 0");
    });

    it("Should revert withdrawal with invalid token address", async function () {
        const { vault, user1 } = await useDeploymentFixture();

        const fakeAmount = "1000000000000000000";
        const fakeEntropy =
            "123456789012345678901234567890123456789012345678901234567890123";

        await expect(
            vault
                .connect(user1)
                .withdraw(
                    ethers.ZeroAddress,
                    BigInt(fakeAmount),
                    BigInt(fakeEntropy)
                )
        ).to.be.revertedWith("Vault: Invalid token address");
    });

    it("Should prevent double withdrawal of the same commitment", async function () {
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

        // Withdraw the commitment
        await vault
            .connect(user1)
            .withdraw(
                mockToken.target,
                BigInt(commitments[0].amount),
                BigInt(commitments[0].entropy)
            );

        // Try to withdraw again
        await expect(
            vault
                .connect(user1)
                .withdraw(
                    mockToken.target,
                    BigInt(commitments[0].amount),
                    BigInt(commitments[0].entropy)
                )
        ).to.be.revertedWith("Vault: Commitment not found");
    });
});
