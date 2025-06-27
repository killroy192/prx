use commitment::{Commitment, verifyHashAndComputeSum_4};

fn main(
    inputs: [Commitment; 4],
    outputs: [Commitment; 4],
    input_hashes: pub [Field; 4],
    output_hashes: pub [Field; 4],
    fee: pub Field,
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_4(inputs, input_hashes, &mut inputs_sum);
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_4(outputs, output_hashes, &mut outputs_sum);
    assert_eq(inputs_sum, outputs_sum + fee);
}
