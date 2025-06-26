import { buildPoseidon } from "circomlibjs";

const poseidon_ = buildPoseidon();

export async function computePoseidon({
    amount,
    entropy,
}: {
    amount: string;
    entropy: string;
}) {
    const poseidon = await poseidon_;
    return poseidon.F.toString(poseidon([BigInt(amount), BigInt(entropy)]));
}