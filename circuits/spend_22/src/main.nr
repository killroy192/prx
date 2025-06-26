use commitment::{Commitment, verifyHashAndComputeSum_2};

fn main(
    inputs: [Commitment; 2],
    outputs: [Commitment; 2],
    input_hashes: pub [Field; 2],
    output_hashes: pub [Field; 2],
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_2(inputs, input_hashes, &mut inputs_sum);
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_2(outputs, output_hashes, &mut outputs_sum);
    assert_eq(inputs_sum, outputs_sum);
}

#[test]
fn test_main() {
    let inputs: [Commitment; 2] = [
        Commitment {
            amount: 10,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 30,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
    ];
    let inputs_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        20618630727072921646853694103526096729172466155476961587477175576877753350762,
    ];
    main(inputs, inputs, inputs_hashes, inputs_hashes)
}
