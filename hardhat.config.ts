import dotenv from "dotenv";
const config = dotenv.config();

import "@nomicfoundation/hardhat-toolbox";
import "@dgma/hardhat-sol-bundler";
import { ZeroHash } from "ethers";
import deployments from "./deployment.config";

if (config.error) {
    console.error(config.error);
  }
  
  const deployerAccounts = [config?.parsed?.PRIVATE_KEY || ZeroHash];

const DEFAULT_RPC = "https:random.com";

export default {
    solidity: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 100000000 } },
    },
    networks: {
        hardhat: {
            deployment: deployments.hardhat,
        },
        localhost: {
            deployment: deployments.localhost,
        },
        opSepolia: {
            url: config?.parsed?.OP_SEPOLIA_RPC || DEFAULT_RPC,
            accounts: deployerAccounts,
            deployment: deployments.opSepolia,
        },
    },
    etherscan: {
        apiKey: {
            opSepolia: config?.parsed?.OPSCAN_API_KEY,
        },
        customChains: [
            {
                network: "opSepolia",
                chainId: 11155420,
                urls: {
                    apiURL: "https://sepolia-optimism.etherscan.io/api",
                    browserURL: "https://sepolia-optimism.etherscan.io/",
                },
            },
        ],
    },
};

