use commitment::{Commitment, verifyCommitment, verifyHashAndComputeSum_2};

fn main(
    input: Commitment,
    outputs: [Commitment; 2],
    input_hash: pub Field,
    output_hashes: pub [Field; 2],
    fee: pub Field
) {
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_2(outputs, output_hashes, &mut outputs_sum);
    verifyCommitment(input, input_hash);
    assert_eq(outputs_sum + fee, input.amount);
}

#[test]
fn test_main() {
    let entropy = 156886990995136757474724201984063439975582257115833425419083960539307750072;
    let fee = 1;
    let outputs: [Commitment; 2] =
        [Commitment { amount: 10, entropy }, Commitment { amount: 29, entropy }];

    let input = Commitment { amount: 40, entropy };

    let output_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        16778214387271838405962377005016079761200539870870426006878697312100755591750,
    ];

    let input_hash = 20164026473074836841103326391740756084007224149338624994523933584381841470799;
    main(input, outputs, input_hash, output_hashes, fee)
}
