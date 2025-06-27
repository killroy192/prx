import { expect } from "chai";
import { ethers } from "hardhat";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../../circuits/deposit/target/deposit.json";
import { computePoseidon } from "../../utils/poseidon";

describe("Deposit Circuit Integration Tests", function () {
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
            input.hashes[i] = await computePoseidon(input.commitments[i]);
            input.total_amount = (
                BigInt(input.total_amount) + amount
            ).toString();
        }
        const start = performance.now();
        const { witness } = await noir.execute(input);
        const { proof, publicInputs } = await backend.generateProof(witness, {
            keccak: true,
        });
        const isValidLocal = await backend.verifyProof(
            { proof, publicInputs },
            {
                keccak: true,
            }
        );
        expect(isValidLocal).to.be.true;

        const isValidOnChain = await verifier.verify(proof, publicInputs);
        expect(isValidOnChain).to.be.true;

        console.log(`witness + proving time: ${performance.now() - start}`);
    });
});
