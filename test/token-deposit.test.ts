import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenDeposit, MockERC20 } from "../typechain-types";

describe("TokenDeposit", function () {
    let tokenDeposit: TokenDeposit;
    let mockToken: MockERC20;
    let owner: any;
    let user1: any;
    let user2: any;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy mock ERC20 token
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20Factory.deploy("Mock Token", "MTK");

        // Deploy TokenDeposit contract
        const TokenDepositFactory = await ethers.getContractFactory(
            "TokenDeposit"
        );
        tokenDeposit = await TokenDepositFactory.deploy();

        // Mint some tokens to users
        await mockToken.mint(user1.address, ethers.parseEther("1000"));
        await mockToken.mint(user2.address, ethers.parseEther("1000"));
    });

    describe("Deposit", function () {
        it("Should allow users to deposit tokens", async function () {
            const depositAmount = ethers.parseEther("100");

            // Approve tokens
            await mockToken
                .connect(user1)
                .approve(tokenDeposit.target, depositAmount);

            // Deposit tokens
            await tokenDeposit
                .connect(user1)
                .deposit(mockToken.target, depositAmount);

            // Check balance
            const balance = await tokenDeposit.getBalance(
                user1.address,
                mockToken.target
            );
            expect(balance).to.equal(depositAmount);

            // Check total deposits
            const totalDeposits = await tokenDeposit.getTotalDeposits(
                mockToken.target
            );
            expect(totalDeposits).to.equal(depositAmount);
        });

        it("Should emit TokenDeposited event", async function () {
            const depositAmount = ethers.parseEther("100");

            await mockToken
                .connect(user1)
                .approve(tokenDeposit.target, depositAmount);

            await expect(
                tokenDeposit
                    .connect(user1)
                    .deposit(mockToken.target, depositAmount)
            )
                .to.emit(tokenDeposit, "TokenDeposited")
                .withArgs(user1.address, mockToken.target, depositAmount);
        });

        it("Should revert if token address is zero", async function () {
            const depositAmount = ethers.parseEther("100");

            await expect(
                tokenDeposit
                    .connect(user1)
                    .deposit(ethers.ZeroAddress, depositAmount)
            ).to.be.revertedWith("TokenDeposit: Invalid token address");
        });

        it("Should revert if amount is zero", async function () {
            await mockToken
                .connect(user1)
                .approve(tokenDeposit.target, ethers.parseEther("100"));

            await expect(
                tokenDeposit.connect(user1).deposit(mockToken.target, 0)
            ).to.be.revertedWith("TokenDeposit: Amount must be greater than 0");
        });
    });

    describe("Emergency Withdraw", function () {
        it("Should allow owner to emergency withdraw all tokens", async function () {
            // Deposit tokens from multiple users
            const depositAmount = ethers.parseEther("100");
            await mockToken
                .connect(user1)
                .approve(tokenDeposit.target, depositAmount);
            await mockToken
                .connect(user2)
                .approve(tokenDeposit.target, depositAmount);
            await tokenDeposit
                .connect(user1)
                .deposit(mockToken.target, depositAmount);
            await tokenDeposit
                .connect(user2)
                .deposit(mockToken.target, depositAmount);

            const initialOwnerBalance = await mockToken.balanceOf(
                owner.address
            );

            await tokenDeposit
                .connect(owner)
                .emergencyWithdraw(mockToken.target);

            const finalOwnerBalance = await mockToken.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(
                initialOwnerBalance + ethers.parseEther("200")
            );
        });

        it("Should revert if called by non-owner", async function () {
            await expect(
                tokenDeposit.connect(user1).emergencyWithdraw(mockToken.target)
            ).to.be.revertedWithCustomError(
                tokenDeposit,
                "OwnableUnauthorizedAccount"
            );
        });
    });
});
