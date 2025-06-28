use commitment::{Commitment, verifyHashAndComputeSum_3, verifyCommitment};

fn main(
    inputs: [Commitment; 3],
    output: Commitment,
    input_hashes: pub [Field; 3],
    output_hash: pub Field,
    fee: pub Field,
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_3(inputs, input_hashes, &mut inputs_sum);
    verifyCommitment(output, output_hash);
    assert_eq(inputs_sum, output.amount + fee);
}
