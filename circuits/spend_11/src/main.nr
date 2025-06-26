use commitment::{Commitment, verifyCommitment};

fn main(input: Commitment, output: Commitment, input_hash: pub Field, output_hash: pub Field) {
    verifyCommitment(output, output_hash);
    verifyCommitment(input, input_hash);
    assert_eq(output.amount, input.amount);
}

#[test]
fn test_main() {
    let entropy = 156886990995136757474724201984063439975582257115833425419083960539307750072;
    let input = Commitment { amount: 40, entropy };
    let input_hash = 20164026473074836841103326391740756084007224149338624994523933584381841470799;
    main(input, input, input_hash, input_hash)
}
