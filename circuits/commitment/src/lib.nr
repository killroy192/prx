use poseidon::poseidon::bn254::hash_2;

pub struct Commitment {
    pub amount: Field,
    pub entropy: Field,
}

pub fn verifyCommitment(commitment: Commitment, hash: Field) {
    let computed = hash_2([commitment.amount, commitment.entropy]);
    assert_eq(computed, hash);
}

pub fn verifyHashAndComputeSum_2(
    commitments: [Commitment; 2],
    hashes: [Field; 2],
    sum: &mut Field,
) {
    for i in 0..2 {
        let commitment: Commitment = commitments[i];
        verifyCommitment(commitment, hashes[i]);
        *sum = *sum + commitment.amount;
    }
}

pub fn verifyHashAndComputeSum_3(
    commitments: [Commitment; 3],
    hashes: [Field; 3],
    sum: &mut Field,
) {
    for i in 0..3 {
        let commitment: Commitment = commitments[i];
        verifyCommitment(commitment, hashes[i]);
        *sum = *sum + commitment.amount;
    }
}
