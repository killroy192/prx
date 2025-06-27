use commitment::{Commitment, verifyCommitment, verifyHashAndComputeSum_3};

fn main(
    input: Commitment,
    outputs: [Commitment; 3],
    input_hash: pub Field,
    output_hashes: pub [Field; 3],
    fee: pub Field,
) {
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_3(outputs, output_hashes, &mut outputs_sum);
    verifyCommitment(input, input_hash);
    assert_eq(outputs_sum + fee, input.amount);
}

#[test]
fn test_main() {
    let entropy = 156886990995136757474724201984063439975582257115833425419083960539307750072;
    let fee = 1;
    let outputs: [Commitment; 3] = [
        Commitment { amount: 9, entropy },
        Commitment { amount: 11, entropy },
        Commitment { amount: 19, entropy },
    ];

    let input = Commitment { amount: 40, entropy };

    let output_hashes: [Field; 3] = [
        11287858662902380099255003281396549132361889096190797048933305184349149344140,
        13993980634543020164489993017027428490484711828777286862189675473557285324679,
        4961853102793206826683988730396051567594079468681414116320644733097731481706,
    ];

    let input_hash = 20164026473074836841103326391740756084007224149338624994523933584381841470799;
    main(input, outputs, input_hash, output_hashes, fee)
}
