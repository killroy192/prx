use commitment::{Commitment, verifyHashAndComputeSum_2};

fn main(
    inputs: [Commitment; 2],
    outputs: [Commitment; 2],
    input_hashes: pub [Field; 2],
    output_hashes: pub [Field; 2],
    fee: pub Field,
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_2(inputs, input_hashes, &mut inputs_sum);
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_2(outputs, output_hashes, &mut outputs_sum);
    assert_eq(inputs_sum, outputs_sum + fee);
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

    let input_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        20618630727072921646853694103526096729172466155476961587477175576877753350762,
    ];

    let fee = 1;

    let outputs: [Commitment; 2] = [
        Commitment {
            amount: 10,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 29,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
    ];

    let output_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        16778214387271838405962377005016079761200539870870426006878697312100755591750,
    ];

    main(inputs, outputs, input_hashes, output_hashes, fee)
}
