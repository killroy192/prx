import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenDeposit, MockERC20, DepositVerifier } from "../typechain-types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/deposit/target/deposit.json";
import { computePoseidon } from "../utils/poseidon";

describe("TokenDeposit", function () {
    let tokenDeposit: TokenDeposit;
    let mockToken: MockERC20;
    let depositVerifier: DepositVerifier;
    let owner: any;
    let user1: any;
    let user2: any;
    let user3: any;
    let noir: Noir;
    let backend: UltraHonkBackend;

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();

        // Initialize Noir and backend
        noir = new Noir(circuit as any);
        backend = new UltraHonkBackend(circuit.bytecode);

        // Deploy DepositVerifier
        const DepositVerifierFactory = await ethers.getContractFactory(
            "DepositVerifier"
        );
        depositVerifier = await DepositVerifierFactory.deploy();

        // Deploy mock ERC20 token
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20Factory.deploy("Mock Token", "MTK");

        // Deploy TokenDeposit contract
        const TokenDepositFactory = await ethers.getContractFactory(
            "TokenDeposit"
        );
        tokenDeposit = await TokenDepositFactory.deploy(depositVerifier.target);

        // Mint some tokens to users
        await mockToken.mint(user1.address, ethers.parseEther("1000"));
        await mockToken.mint(user2.address, ethers.parseEther("1000"));
        await mockToken.mint(user3.address, ethers.parseEther("1000"));
    });

    describe("Deposit", function () {
        it("Should successfully deposit with valid ZK proof using current contract logic", async function () {
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
            const { proof, publicInputs } = await backend.generateProof(
                witness,
                {
                    keccak: true,
                }
            );

            // Verify the proof locally first
            const isValidLocal = await backend.verifyProof(
                { proof, publicInputs },
                { keccak: true }
            );
            expect(isValidLocal).to.be.true;

            // Now test with the contract - this should fail if my analysis is correct
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

            // Approve tokens
            await mockToken
                .connect(user1)
                .approve(tokenDeposit.target, BigInt(totalAmount));

            // This should fail if the contract's public inputs don't match the circuit expectations
            await tokenDeposit
                .connect(user1)
                .deposit(
                    mockToken.target,
                    BigInt(totalAmount),
                    depositCommitmentParams,
                    proof
                );

            // If we get here, my analysis was wrong
            console.log("Test passed - contract logic is correct!");
        });
    });

    describe("Emergency Withdraw", function () {
        it("Should allow owner to emergency withdraw all tokens", async function () {
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
            await mockToken
                .connect(user1)
                .approve(tokenDeposit.target, depositAmount);
            await mockToken
                .connect(user2)
                .approve(tokenDeposit.target, depositAmount);

            await tokenDeposit
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

            await tokenDeposit
                .connect(user2)
                .deposit(
                    mockToken.target,
                    depositAmount,
                    depositCommitmentParams2,
                    proof2
                );

            const initialOwnerBalance = await mockToken.balanceOf(
                owner.address
            );

            await tokenDeposit
                .connect(owner)
                .emergencyWithdraw(mockToken.target);

            const finalOwnerBalance = await mockToken.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(
                initialOwnerBalance + BigInt(totalAmount) * 2n
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
