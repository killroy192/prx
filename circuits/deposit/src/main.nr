use commitment::{Commitment, verifyHashAndComputeSum};

fn main(commitments: [Commitment; 3], hashes: pub [Field; 3], total_amount: pub Field) {
    let mut sum: Field = 0;
    verifyHashAndComputeSum(commitments, hashes, &mut sum);
    assert_eq(sum, total_amount);
}

#[test]
fn test_main() {
    let commitments: [Commitment; 3] = [
        Commitment {
            amount: 10,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 0,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
        Commitment {
            amount: 30,
            entropy: 156886990995136757474724201984063439975582257115833425419083960539307750072,
        },
    ];
    let total_amount: Field = 40;
    let hashes: [Field; 3] = [
        292245211693241296915613138325787484641862881480616938388205960637044468447,
        20177553709337174692858549403923558388624998425681154381715196237786881449358,
        20618630727072921646853694103526096729172466155476961587477175576877753350762,
    ];
    main(commitments, hashes, total_amount)
}
