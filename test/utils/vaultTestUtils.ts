import { ethers } from "hardhat";
import { Vault, MockERC20 } from "../../typechain-types";
import { computePoseidon } from "../../utils/poseidon";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Signer } from "ethers";

export interface Commitment {
    amount: string;
    entropy: string;
}

export interface CommitmentWithHash {
    commitment: Commitment;
    hash: string;
}

export interface DepositSetup {
    commitments: Commitment[];
    hashes: string[];
    totalAmount: bigint;
    proof: string;
}

export interface SpendTransaction {
    deadline: number;
    token: string;
    inputsPoseidonHashes: string[];
    outputsPoseidonHashes: string[];
    inputWitnesses: Array<{ signature: string; indexes: number[] }>;
    outputWitnesses: Array<{ owner: string; indexes: number[] }>;
    fee: bigint;
}

/**
 * Generate unique entropy for testing
 */
function generateEntropy(index: number): string {
    // Generate a numeric string that can be converted to BigInt
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `${timestamp}${random}${index}`;
}

/**
 * Create commitments with auto-generated entropy
 */
export function makeCommitments(amounts: string[]): Commitment[] {
    return amounts.map((amount, index) => ({
        amount,
        entropy: generateEntropy(index),
    }));
}

/**
 * Create commitments and compute their Poseidon hashes
 */
export async function makeCommitmentsWithHashes(
    amounts: string[]
): Promise<CommitmentWithHash[]> {
    const commitments = makeCommitments(amounts);
    const hashes = await Promise.all(
        commitments.map((c) => computePoseidon(c))
    );

    return commitments.map((commitment, index) => ({
        commitment,
        hash: hashes[index],
    }));
}

/**
 * Setup a deposit with given amounts and owners
 */
export async function setupDeposit(
    vault: Vault,
    token: MockERC20,
    user: Signer,
    amounts: string[],
    owners: string[],
    noir: Noir,
    backend: UltraHonkBackend
): Promise<DepositSetup> {
    const commitmentsWithHashes = await makeCommitmentsWithHashes(amounts);
    const commitments = commitmentsWithHashes.map((c) => c.commitment);
    const hashes = commitmentsWithHashes.map((c) => c.hash);
    const totalAmount = amounts.reduce(
        (sum, amount) => sum + BigInt(amount),
        0n
    );

    // Create deposit input
    const depositInput = {
        commitments,
        hashes,
        total_amount: totalAmount.toString(),
    };

    // Generate proof
    const { witness } = await noir.execute(depositInput);
    const { proof } = await backend.generateProof(witness, { keccak: true });

    // Create commitment params
    const commitmentParams: [
        Vault.DepositCommitmentParamsStruct,
        Vault.DepositCommitmentParamsStruct,
        Vault.DepositCommitmentParamsStruct
    ] = [
        { poseidonHash: hashes[0], owner: owners[0] },
        { poseidonHash: hashes[1], owner: owners[1] },
        { poseidonHash: hashes[2], owner: owners[2] },
    ];

    // Perform deposit
    await token.connect(user).approve(vault.target, totalAmount);
    await vault
        .connect(user)
        .deposit(token.target, totalAmount, commitmentParams, proof);

    return { commitments, hashes, totalAmount, proof };
}

/**
 * Create a spend transaction structure
 */
export function createSpendTransaction(
    inputHash: string,
    outputHash: string,
    recipient: string,
    deadline: number,
    token: string,
    fee: bigint = 0n
): SpendTransaction {
    return {
        deadline,
        token,
        inputsPoseidonHashes: [inputHash],
        outputsPoseidonHashes: [outputHash],
        inputWitnesses: [{ signature: "0x", indexes: [0] }],
        outputWitnesses: [{ owner: recipient, indexes: [0] }],
        fee,
    };
}

/**
 * Encode and sign a spend transaction
 */
export async function encodeAndSignTransaction(
    tx: SpendTransaction,
    signer: Signer
): Promise<string> {
    const hash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            [
                "uint256",
                "address",
                "uint256[]",
                "uint256[]",
                "tuple(address,uint8[])[]",
                "uint240",
            ],
            [
                tx.deadline,
                tx.token,
                tx.inputsPoseidonHashes,
                tx.outputsPoseidonHashes,
                tx.outputWitnesses.map((w) => [w.owner, w.indexes]),
                tx.fee,
            ]
        )
    );

    return signer.signMessage(ethers.getBytes(hash));
}

/**
 * Generate a spend proof using Noir and UltraHonkBackend
 */
export async function generateSpendProof(
    inputCommitment: Commitment,
    outputCommitment: Commitment,
    inputHash: string,
    outputHash: string,
    fee: string = "0",
    circuit: any
): Promise<string> {
    const spendInput = {
        input: inputCommitment,
        output: outputCommitment,
        input_hash: inputHash,
        output_hash: outputHash,
        fee: fee,
    };

    const spendNoir = new Noir(circuit as any);
    const spendBackend = new UltraHonkBackend(circuit.bytecode);

    const { witness: spendWitness } = await spendNoir.execute(spendInput);
    const { proof: spendProof } = await spendBackend.generateProof(
        spendWitness,
        { keccak: true }
    );

    return spendProof;
}

/**
 * Create a deadline that expires in the future
 */
export function createFutureDeadline(hoursFromNow: number = 1): number {
    return Math.floor(Date.now() / 1000) + hoursFromNow * 3600;
}

/**
 * Create a deadline that has already expired
 */
export function createExpiredDeadline(hoursAgo: number = 1): number {
    return Math.floor(Date.now() / 1000) - hoursAgo * 3600;
}

/**
 * Helper to create a standard 1-to-1 spend setup
 */
export async function setupStandardSpend(
    vault: Vault,
    token: MockERC20,
    user1: Signer,
    user2: Signer,
    noir: Noir,
    backend: UltraHonkBackend,
    circuit: any
): Promise<{
    inputCommitment: Commitment;
    outputCommitment: Commitment;
    inputHash: string;
    outputHash: string;
    transaction: SpendTransaction;
    proof: string;
}> {
    // Setup deposit
    const {
        commitments: [inputCommitment],
        hashes: [inputHash],
    } = await setupDeposit(
        vault,
        token,
        user1,
        ["1000000000000000000", "0", "0"], // 1 token + 2 zero commitments
        [user1.address, user2.address, user2.address], // owners
        noir,
        backend
    );

    // Create output commitment
    const [outputCommitment] = makeCommitments(["1000000000000000000"]);
    const outputHash = await computePoseidon(outputCommitment);

    // Create transaction
    const deadline = createFutureDeadline();
    const transaction = createSpendTransaction(
        inputHash,
        outputHash,
        user2.address,
        deadline,
        token.target
    );

    // Generate proof
    const proof = await generateSpendProof(
        inputCommitment,
        outputCommitment,
        inputHash,
        outputHash,
        "0",
        circuit
    );

    return {
        inputCommitment,
        outputCommitment,
        inputHash,
        outputHash,
        transaction,
        proof,
    };
}
