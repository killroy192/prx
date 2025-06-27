use commitment::{Commitment, verifyHashAndComputeSum_3};

fn main(
    inputs: [Commitment; 3],
    outputs: [Commitment; 3],
    input_hashes: pub [Field; 3],
    output_hashes: pub [Field; 3],
    fee: pub Field,
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_3(inputs, input_hashes, &mut inputs_sum);
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_3(outputs, output_hashes, &mut outputs_sum);
    assert_eq(inputs_sum, outputs_sum + fee);
}
