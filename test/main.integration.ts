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
            // Generate witness for x=1 (private input only)
            // y=2 is the public input that will be passed to the verifier
            const { witness } = await noir.execute({ x: 1, y: 2 });

            // Generate proof
            console.log("Generating proof... ⏳");
            const proof = await backend.generateProof(witness);
            console.log("Generated proof... ✅");
            console.log("Proof length:", proof.proof.length, "bytes");
            console.log("Expected length:", 440 * 32, "bytes");

            // Verify proof locally first
            console.log("Verifying proof locally... ⌛");
            const isValidLocal = await backend.verifyProof(proof);
            console.log(
                `Local verification: ${
                    isValidLocal ? "valid" : "invalid"
                }... ✅`
            );
            expect(isValidLocal).to.be.true;

            // Verify proof on-chain
            console.log("Verifying proof on-chain... ⌛");
            try {
                const isValidOnChain = await verifier.verify(
                    proof.proof,
                    proof.publicInputs
                );
                console.log(
                    `On-chain verification: ${
                        isValidOnChain ? "valid" : "invalid"
                    }... ✅`
                );
                expect(isValidOnChain).to.be.true;
            } catch (error) {
                console.error("On-chain verification failed:", error);
                throw error;
            }
        });
    });
});
