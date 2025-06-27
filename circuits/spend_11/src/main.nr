use commitment::{Commitment, verifyCommitment};

fn main(input: Commitment, output: Commitment, input_hash: pub Field, output_hash: pub Field, fee: pub Field) {
    verifyCommitment(output, output_hash);
    verifyCommitment(input, input_hash);
    assert_eq(output.amount + fee, input.amount);
}

#[test]
fn test_main() {
    let entropy = 156886990995136757474724201984063439975582257115833425419083960539307750072;
    let input = Commitment { amount: 40, entropy };
    let output = Commitment { amount: 39, entropy };
    let fee = 1;
    let input_hash = 20164026473074836841103326391740756084007224149338624994523933584381841470799;
    let output_hash = 4669403701395517162420167332692147849353210206126954843781335669221097103996;
    main(input, output, input_hash, output_hash, fee)
}
