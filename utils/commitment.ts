import { computePoseidon } from "./poseidon";

const commitmentTemplate = {
    amount: "",
    entropy: "0x58cb7deb6c37f0c959d0b94575c9a9114ad77b7456231c1b7a4c1f51e2b2b8",
};

async function main() {
    const commitment = { ...commitmentTemplate, amount: process.argv[2] };
    console.log(await computePoseidon(commitment));
}

main();
