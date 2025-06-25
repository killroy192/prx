import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1,
            },
            viaIR: false,
        },
    },
    networks: {
        hardhat: {
            blockGasLimit: 30000000,
            gas: 30000000,
            allowUnlimitedContractSize: true,
        },
    },
};

export default config;
