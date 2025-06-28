import { dynamicAddress } from "@dgma/hardhat-sol-bundler";

const config = {
    MockERC20: {
        args: ["MockERC20", "MCK"],
    },
    PoseidonT3: {},
    PoseidonWrapper: {
        options: {
            libs: {
                PoseidonT3: dynamicAddress("PoseidonT3"),
            },
        },
    },
    DepositVerifier: {},
    Spend11Verifier: {},
    Spend12Verifier: {},
    Spend13Verifier: {},
    Spend21Verifier: {},
    Spend22Verifier: {},
    Spend23Verifier: {},
    Spend31Verifier: {},
    Spend32Verifier: {},
    Vault: {
        args: [
            dynamicAddress("DepositVerifier"),
            dynamicAddress("Spend11Verifier"),
            dynamicAddress("Spend12Verifier"),
            dynamicAddress("Spend13Verifier"),
            dynamicAddress("Spend21Verifier"),
            dynamicAddress("Spend22Verifier"),
            dynamicAddress("Spend23Verifier"),
            dynamicAddress("Spend31Verifier"),
            dynamicAddress("Spend32Verifier"),
            dynamicAddress("PoseidonWrapper"),
        ],
    },
};

export default {
    hardhat: {
        config: config,
    },
    localhost: { lockFile: "./local.deployment-lock.json", config: config },
    opSepolia: {
        lockFile: "./deployment-lock.json",
        // verify: true,
        // plugins: [VerifyPlugin],
        config: config,
    },
};
