import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/target/circuits.json";

async function main() {
    const noir = new Noir(circuit as any);
    const backend = new UltraHonkBackend(circuit.bytecode);

    const { witness } = await noir.execute({ x: 1, y: 2 });

    console.log("logs", "Generating proof... ⏳");
    const proof = await backend.generateProof(witness);
    console.log("logs", "Generated proof... ✅");
    console.log("results", proof.proof);

    console.log("logs", "Verifying proof... ⌛");
    const isValid = await backend.verifyProof(proof);
    console.log("logs", `Proof is ${isValid ? "valid" : "invalid"}... ✅`);
}

main();
