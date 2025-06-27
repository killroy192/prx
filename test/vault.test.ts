import { expect } from "chai";
import { ethers } from "hardhat";
import {
    Vault,
    MockERC20,
    DepositVerifier,
    PoseidonWrapper,
} from "../typechain-types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/deposit/target/deposit.json";
import { computePoseidon } from "../utils/poseidon";

describe("Vault", function () {
    let vault: Vault;
    let mockToken: MockERC20;
    let depositVerifier: DepositVerifier;
    let poseidonWrapper: PoseidonWrapper;
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

        // Deploy PoseidonT3 library
        const PoseidonT3Factory = await ethers.getContractFactory("PoseidonT3");
        const poseidonT3 = await PoseidonT3Factory.deploy();

        // Link PoseidonT3 when deploying PoseidonWrapper
        const PoseidonWrapperFactory = await ethers.getContractFactory(
            "PoseidonWrapper",
            {
                libraries: {
                    PoseidonT3: poseidonT3.target,
                },
            }
        );
        poseidonWrapper = await PoseidonWrapperFactory.deploy();

        // Deploy mock ERC20 token
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20Factory.deploy("Mock Token", "MTK");

        // Deploy Vault contract
        const VaultFactory = await ethers.getContractFactory("Vault");
        vault = await VaultFactory.deploy(
            depositVerifier.target,
            poseidonWrapper.target
        );

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
                .approve(vault.target, BigInt(totalAmount));

            // This should fail if the contract's public inputs don't match the circuit expectations
            await vault
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

        it("Should compute Poseidon hash on-chain correctly", async function () {
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

        it("Should successfully withdraw a commitment", async function () {
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

            const depositCommitmentParams: [any, any, any] = [
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

            const depositCommitmentParams: [any, any, any] = [
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

            const depositCommitmentParams: [any, any, any] = [
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

            const initialOwnerBalance = await mockToken.balanceOf(
                owner.address
            );

            await vault.connect(owner).emergencyWithdraw(mockToken.target);

            const finalOwnerBalance = await mockToken.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(
                initialOwnerBalance + BigInt(totalAmount) * 2n
            );
        });

        it("Should revert if called by non-owner", async function () {
            await expect(
                vault.connect(user1).emergencyWithdraw(mockToken.target)
            ).to.be.revertedWithCustomError(
                vault,
                "OwnableUnauthorizedAccount"
            );
        });
    });
});
