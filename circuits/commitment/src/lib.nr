use poseidon::poseidon::bn254::hash_2;

pub struct Commitment {
    pub amount: Field,
    pub entropy: Field,
}

pub fn verifyHashAndComputeSum(commitments: [Commitment; 3], hashes: [Field; 3], sum: &mut Field) {
    for i in 0..3 {
        let commitment: Commitment = commitments[i];
        let computed = hash_2([commitment.amount, commitment.entropy]);
        assert_eq(computed, hashes[i]);
        *sum = *sum + commitment.amount;
    }
}
