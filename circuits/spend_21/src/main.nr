use commitment::{Commitment, verifyCommitment, verifyHashAndComputeSum_2};

fn main(
    inputs: [Commitment; 2],
    output: Commitment,
    input_hashes: pub [Field; 2],
    output_hash: pub Field,
    fee: pub Field,
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_2(inputs, input_hashes, &mut inputs_sum);
    verifyCommitment(output, output_hash);
    assert_eq(inputs_sum, output.amount + fee);
}

#[test]
fn test_main() {
    let entropy =
        156886990995136757474724201984063439975582257115833425419083960539307750072;

    let fee = 1;

    let inputs: [Commitment; 2] =
        [Commitment { amount: 10, entropy }, Commitment { amount: 30, entropy }];

    let output = Commitment { amount: 39, entropy };

    let input_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        20618630727072921646853694103526096729172466155476961587477175576877753350762,
    ];

    let output_hash =
        4669403701395517162420167332692147849353210206126954843781335669221097103996;
    main(inputs, output, input_hashes, output_hash, fee)
}
