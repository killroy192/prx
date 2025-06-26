use commitment::{Commitment, verifyCommitment, verifyHashAndComputeSum_2};

fn main(
    input: Commitment,
    outputs: [Commitment; 2],
    input_hash: pub Field,
    output_hashes: pub [Field; 2],
) {
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_2(outputs, output_hashes, &mut outputs_sum);
    verifyCommitment(input, input_hash);
    assert_eq(outputs_sum, input.amount);
}

#[test]
fn test_main() {
    let entropy = 156886990995136757474724201984063439975582257115833425419083960539307750072;
    let outputs: [Commitment; 2] =
        [Commitment { amount: 10, entropy }, Commitment { amount: 30, entropy }];

    let input = Commitment { amount: 40, entropy };

    let output_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        20618630727072921646853694103526096729172466155476961587477175576877753350762,
    ];

    let input_hash = 20164026473074836841103326391740756084007224149338624994523933584381841470799;
    main(input, outputs, input_hash, output_hashes)
}
