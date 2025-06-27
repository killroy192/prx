use commitment::{Commitment, verifyHashAndComputeSum_2, verifyHashAndComputeSum_3};

fn main(
    inputs: [Commitment; 3],
    outputs: [Commitment; 2],
    input_hashes: pub [Field; 3],
    output_hashes: pub [Field; 2],
    fee: pub Field,
) {
    let mut inputs_sum: Field = 0;
    verifyHashAndComputeSum_3(inputs, input_hashes, &mut inputs_sum);
    let mut outputs_sum: Field = 0;
    verifyHashAndComputeSum_2(outputs, output_hashes, &mut outputs_sum);
    assert_eq(inputs_sum, outputs_sum + fee);
}

#[test]
fn test_main() {
    let inputs: [Commitment; 3] = [
        Commitment {
            amount: 10,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 5,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 15,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
    ];

    let input_hashes: [Field; 3] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        1242936717767480800953067939551977922961882018629088569618896133963140349636,
        4946465234154514451234044621457623119462609104867390435744349740980200925580,
    ];

    let fee: Field = 1;

    let outputs: [Commitment; 2] = [
        Commitment {
            amount: 10,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 19,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
    ];

    let output_hashes: [Field; 2] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        4961853102793206826683988730396051567594079468681414116320644733097731481706,
    ];

    main(inputs, outputs, input_hashes, output_hashes, fee)
}
