import { expect } from "chai";
import { ethers } from "hardhat";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/basic/target/basic.json";

describe("Verifier Integration Tests", function () {
    let verifier: any;
    let noir: Noir;
    let backend: UltraHonkBackend;

    before(async function () {
        // Initialize Noir and backend
        noir = new Noir(circuit as any);
        backend = new UltraHonkBackend(circuit.bytecode);

        // Deploy the verifier contract
        const Verifier = await ethers.getContractFactory("HonkVerifier");
        verifier = await Verifier.deploy();
        await verifier.waitForDeployment();
    });

    describe("Basic Circuit Verification", function () {
        it("should verify a valid proof for x=1, y=2", async function () {
            // Generate witness for x=1, y=2 (where x != y)
            const { witness } = await noir.execute({ x: 1, y: 2 });

            // Generate proof
            console.log("Generating proof... ⏳");
            const proof = await backend.generateProof(witness);
            console.log("Generated proof... ✅");

            // Verify proof locally first
            console.log("Verifying proof locally... ⌛");
            const isValidLocal = await backend.verifyProof(proof);
            console.log(
                `Local verification: ${
                    isValidLocal ? "valid" : "invalid"
                }... ✅`
            );
            expect(isValidLocal).to.be.true;

            // Prepare public inputs for on-chain verification
            // The circuit has one public input: y
            const publicInputs = [ethers.zeroPadValue(ethers.toBeHex(2), 32)];

            // Verify proof on-chain
            console.log("Verifying proof on-chain... ⌛");
            const isValidOnChain = await verifier.verify(
                proof.proof,
                publicInputs
            );
            console.log(
                `On-chain verification: ${
                    isValidOnChain ? "valid" : "invalid"
                }... ✅`
            );
            expect(isValidOnChain).to.be.true;
        });

        it("should verify a valid proof for x=5, y=10", async function () {
            // Generate witness for x=5, y=10 (where x != y)
            const { witness } = await noir.execute({ x: 5, y: 10 });

            // Generate proof
            console.log("Generating proof for x=5, y=10... ⏳");
            const proof = await backend.generateProof(witness);
            console.log("Generated proof... ✅");

            // Verify proof locally first
            const isValidLocal = await backend.verifyProof(proof);
            expect(isValidLocal).to.be.true;

            // Prepare public inputs for on-chain verification
            const publicInputs = [ethers.zeroPadValue(ethers.toBeHex(10), 32)];

            // Verify proof on-chain
            const isValidOnChain = await verifier.verify(
                proof.proof,
                publicInputs
            );
            expect(isValidOnChain).to.be.true;
        });

        it("should verify a valid proof for x=0, y=1", async function () {
            // Generate witness for x=0, y=1 (where x != y)
            const { witness } = await noir.execute({ x: 0, y: 1 });

            // Generate proof
            console.log("Generating proof for x=0, y=1... ⏳");
            const proof = await backend.generateProof(witness);
            console.log("Generated proof... ✅");

            // Verify proof locally first
            const isValidLocal = await backend.verifyProof(proof);
            expect(isValidLocal).to.be.true;

            // Prepare public inputs for on-chain verification
            const publicInputs = [ethers.zeroPadValue(ethers.toBeHex(1), 32)];

            // Verify proof on-chain
            const isValidOnChain = await verifier.verify(
                proof.proof,
                publicInputs
            );
            expect(isValidOnChain).to.be.true;
        });
    });

    describe("Error Cases", function () {
        it("should reject invalid public inputs", async function () {
            // Generate a valid proof
            const { witness } = await noir.execute({ x: 1, y: 2 });
            const proof = await backend.generateProof(witness);

            // Try to verify with wrong public input (y=3 instead of y=2)
            const wrongPublicInputs = [
                ethers.zeroPadValue(ethers.toBeHex(3), 32),
            ];

            // This should fail because the proof was generated for y=2, not y=3
            const isValid = await verifier.verify(
                proof.proof,
                wrongPublicInputs
            );
            expect(isValid).to.be.false;
        });

        it("should reject invalid proof length", async function () {
            // Create an invalid proof (wrong length)
            const invalidProof = ethers.randomBytes(100); // Wrong size
            const publicInputs = [ethers.zeroPadValue(ethers.toBeHex(2), 32)];

            // This should revert due to wrong proof length
            await expect(
                verifier.verify(invalidProof, publicInputs)
            ).to.be.revertedWithCustomError(verifier, "ProofLengthWrong");
        });

        it("should reject wrong number of public inputs", async function () {
            // Generate a valid proof
            const { witness } = await noir.execute({ x: 1, y: 2 });
            const proof = await backend.generateProof(witness);

            // Try to verify with wrong number of public inputs
            const wrongPublicInputs = [
                ethers.zeroPadValue(ethers.toBeHex(2), 32),
                ethers.zeroPadValue(ethers.toBeHex(3), 32), // Extra input
            ];

            // This should revert due to wrong number of public inputs
            await expect(
                verifier.verify(proof.proof, wrongPublicInputs)
            ).to.be.revertedWithCustomError(
                verifier,
                "PublicInputsLengthWrong"
            );
        });
    });

    describe("Performance Tests", function () {
        it("should handle multiple verifications efficiently", async function () {
            const testCases = [
                { x: 1, y: 2 },
                { x: 3, y: 7 },
                { x: 10, y: 20 },
                { x: 100, y: 200 },
                { x: 1000, y: 2000 },
            ];

            for (const testCase of testCases) {
                // Generate witness and proof
                const { witness } = await noir.execute(testCase);
                const proof = await backend.generateProof(witness);

                // Verify locally
                const isValidLocal = await backend.verifyProof(proof);
                expect(isValidLocal).to.be.true;

                // Verify on-chain
                const publicInputs = [
                    ethers.zeroPadValue(ethers.toBeHex(testCase.y), 32),
                ];
                const isValidOnChain = await verifier.verify(
                    proof.proof,
                    publicInputs
                );
                expect(isValidOnChain).to.be.true;
            }
        });
    });

    describe("Contract Information", function () {
        it("should have correct contract configuration", async function () {
            // The contract should be deployed successfully
            expect(verifier.target).to.be.a("string");
            expect(verifier.target.length).to.be.greaterThan(0);

            // Log contract address for reference
            console.log(`Verifier contract deployed at: ${verifier.target}`);
        });
    });
});
