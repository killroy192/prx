import { expect } from "chai";
import { ethers } from "hardhat";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../../circuits/spend_44/target/spend_44.json";
import { computePoseidon } from "../../utils/poseidon";

const cloneInList = (size: number, data: object) => {
    return Array.from({ length: size }).fill(data);
};

describe("Spend 44 Circuit Integration Tests", function () {
    let verifier: any;
    let noir: Noir;
    let backend: UltraHonkBackend;

    before(async function () {
        // Initialize Noir and backend
        noir = new Noir(circuit as any);
        backend = new UltraHonkBackend(circuit.bytecode);

        // Deploy the verifier contract
        const Verifier = await ethers.getContractFactory("Spend44Verifier");
        verifier = await Verifier.deploy();
        await verifier.waitForDeployment();
    });

    it("valid case", async function () {
        const entropy =
            "0x123456789012345678901234567890123456789012345678901234567890123";
        const amount = (
            BigInt(Math.ceil(Math.random() * 1000)) *
            1962032335615093305919915752779923492862405119078726351644279745651970028n
        ).toString();
        const commitment = { amount, entropy };
        const hash = await computePoseidon(commitment);

        const start = performance.now();
        const { witness } = await noir.execute({
            inputs: cloneInList(4, commitment),
            input_hashes: cloneInList(4, hash),
            outputs: cloneInList(4, commitment),
            output_hashes: cloneInList(4, hash),
            fee: 0,
        });
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
