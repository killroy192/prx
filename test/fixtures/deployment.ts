import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    Vault,
    MockERC20,
    DepositVerifier,
    PoseidonWrapper,
} from "../../typechain-types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../../circuits/deposit/target/deposit.json";

export interface DeploymentFixture {
    vault: Vault;
    mockToken: MockERC20;
    depositVerifier: DepositVerifier;
    poseidonWrapper: PoseidonWrapper;
    owner: any;
    user1: any;
    user2: any;
    user3: any;
    noir: Noir;
    backend: UltraHonkBackend;
}

export async function deployFixture(): Promise<DeploymentFixture> {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Initialize Noir and backend
    const noir = new Noir(circuit as any);
    const backend = new UltraHonkBackend(circuit.bytecode);

    // Deploy DepositVerifier
    const DepositVerifierFactory = await ethers.getContractFactory(
        "DepositVerifier"
    );
    const depositVerifier = await DepositVerifierFactory.deploy();

    // Deploy PoseidonT3 library
    const PoseidonT3Factory = await ethers.getContractFactory("PoseidonT3");
    const poseidonT3 = await PoseidonT3Factory.deploy();

    // Link PoseidonT3 when deploying PoseidonWrapper
    const PoseidonWrapperFactory = await ethers.getContractFactory(
        "PoseidonWrapper",
        {
            libraries: {
                PoseidonT3: poseidonT3.target,
            },
        }
    );
    const poseidonWrapper = await PoseidonWrapperFactory.deploy();

    // Deploy mock ERC20 token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20Factory.deploy("Mock Token", "MTK");

    // Deploy Vault contract
    const VaultFactory = await ethers.getContractFactory("Vault");
    const vault = await VaultFactory.deploy(
        depositVerifier.target,
        poseidonWrapper.target
    );

    // Mint some tokens to users
    await mockToken.mint(user1.address, ethers.parseEther("1000"));
    await mockToken.mint(user2.address, ethers.parseEther("1000"));
    await mockToken.mint(user3.address, ethers.parseEther("1000"));

    return {
        vault,
        mockToken,
        depositVerifier,
        poseidonWrapper,
        owner,
        user1,
        user2,
        user3,
        noir,
        backend,
    };
}

export function useDeploymentFixture() {
    return loadFixture(deployFixture);
}
