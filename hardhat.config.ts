import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.29",
        settings: { optimizer: { enabled: true, runs: 100000000 } },
    },
    networks: {
        hardhat: {},
    },
};

export default config;
