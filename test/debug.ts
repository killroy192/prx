import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/basic/target/basic.json";

async function debugProof() {
    console.log("=== Debug Proof Generation and Verification ===");

    // Initialize Noir and backend
    const noir = new Noir(circuit as any);
    const backend = new UltraHonkBackend(circuit.bytecode);

    console.log("Circuit info:");
    console.log("- Circuit size:", circuit.bytecode.length);
    console.log("- Circuit hash:", circuit.hash);

    // Generate witness
    const { witness } = await noir.execute({ x: 1, y: 2 });
    console.log("Witness generated successfully");

    // Generate proof
    console.log("Generating proof...");
    const proof = await backend.generateProof(witness);
    console.log("Proof generated successfully");
    console.log("Proof length:", proof.proof.length);

    // Verify proof locally
    console.log("Verifying proof locally...");
    const isValidLocal = await backend.verifyProof(proof);
    console.log("Local verification result:", isValidLocal);

    // Log proof details for debugging
    console.log("Proof details:");
    console.log("- Proof bytes (first 100):", proof.proof.slice(0, 100));
    console.log("- Public inputs:", proof.publicInputs);

    return { proof, isValidLocal };
}

debugProof().catch(console.error);
