import { expect } from "chai";
import { ethers } from "hardhat";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/deposit/target/deposit.json";
import { buildPoseidon } from "circomlibjs";

const poseidon_ = buildPoseidon();

async function getHash({
    amount,
    entropy,
}: {
    amount: string;
    entropy: string;
}) {
    const poseidon = await poseidon_;
    return poseidon.F.toString(poseidon([BigInt(amount), BigInt(entropy)]));
}

describe("Verifier Integration Tests", function () {
    let verifier: any;
    let noir: Noir;
    let backend: UltraHonkBackend;

    before(async function () {
        // Initialize Noir and backend
        noir = new Noir(circuit as any);
        backend = new UltraHonkBackend(circuit.bytecode);

        // Deploy the verifier contract
        const Verifier = await ethers.getContractFactory("DepositVerifier");
        verifier = await Verifier.deploy();
        await verifier.waitForDeployment();
    });

    describe("Basic Circuit Verification", function () {
        it("valid case", async function () {
            const input = {
                commitments: [
                    {
                        amount: "",
                        entropy:
                            "0x123456789012345678901234567890123456789012345678901234567890123",
                    },
                    {
                        amount: "",
                        entropy:
                            "0x345678901234567890123456789012345678901234567890123456789012345",
                    },
                    {
                        amount: "",
                        entropy:
                            "0x456789012345678901234567890123456789012345678901234567890123456",
                    },
                ],
                total_amount: "",
                hashes: ["", "", ""],
            };

            for (let i = 0; i < 3; i++) {
                const amount =
                    BigInt(Math.ceil(Math.random() * 1000)) *
                    1962032335615093305919915752779923492862405119078726351644279745651970028n;
                input.commitments[i].amount = amount.toString();
                input.hashes[i] = await getHash(input.commitments[i]);
                input.total_amount = (
                    BigInt(input.total_amount) + amount
                ).toString();
            }
            const start = performance.now();
            const { witness } = await noir.execute(input);

            // Generate proof
            console.log("Generating proof... ⏳");
            const { proof, publicInputs } = await backend.generateProof(
                witness,
                {
                    keccak: true,
                }
            );
            console.log(`witness + proving time: ${performance.now() - start}`);
            // Verify proof locally first
            console.log("Verifying proof locally... ⌛");
            const isValidLocal = await backend.verifyProof(
                { proof, publicInputs },
                {
                    keccak: true,
                }
            );
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
                    proof,
                    publicInputs
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
