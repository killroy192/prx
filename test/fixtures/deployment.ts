import { ethers } from "hardhat";
import { type HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    Vault,
    MockERC20,
    DepositVerifier,
    Spend11Verifier,
    Spend12Verifier,
    Spend13Verifier,
    Spend21Verifier,
    Spend22Verifier,
    Spend23Verifier,
    Spend31Verifier,
    Spend32Verifier,
    PoseidonWrapper,
} from "../../typechain-types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import circuit from "../../circuits/deposit/target/deposit.json";

export interface DeploymentFixture {
    vault: Vault;
    mockToken: MockERC20;
    depositVerifier: DepositVerifier;
    spend11Verifier: Spend11Verifier;
    spend12Verifier: Spend12Verifier;
    spend13Verifier: Spend13Verifier;
    spend21Verifier: Spend21Verifier;
    spend22Verifier: Spend22Verifier;
    spend23Verifier: Spend23Verifier;
    spend31Verifier: Spend31Verifier;
    spend32Verifier: Spend32Verifier;
    poseidonWrapper: PoseidonWrapper;
    owner: HardhatEthersSigner;
    user1: HardhatEthersSigner;
    user2: HardhatEthersSigner;
    user3: HardhatEthersSigner;
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

    // Deploy Spend11Verifier
    const Spend11VerifierFactory = await ethers.getContractFactory(
        "Spend11Verifier"
    );
    const spend11Verifier = await Spend11VerifierFactory.deploy();

    // Deploy Spend12Verifier
    const Spend12VerifierFactory = await ethers.getContractFactory(
        "Spend12Verifier"
    );
    const spend12Verifier = await Spend12VerifierFactory.deploy();

    // Deploy Spend13Verifier
    const Spend13VerifierFactory = await ethers.getContractFactory(
        "Spend13Verifier"
    );
    const spend13Verifier = await Spend13VerifierFactory.deploy();

    // Deploy Spend21Verifier
    const Spend21VerifierFactory = await ethers.getContractFactory(
        "Spend21Verifier"
    );
    const spend21Verifier = await Spend21VerifierFactory.deploy();

    // Deploy Spend22Verifier
    const Spend22VerifierFactory = await ethers.getContractFactory(
        "Spend22Verifier"
    );
    const spend22Verifier = await Spend22VerifierFactory.deploy();

    // Deploy Spend23Verifier
    const Spend23VerifierFactory = await ethers.getContractFactory(
        "Spend23Verifier"
    );
    const spend23Verifier = await Spend23VerifierFactory.deploy();

    // Deploy Spend31Verifier
    const Spend31VerifierFactory = await ethers.getContractFactory(
        "Spend31Verifier"
    );
    const spend31Verifier = await Spend31VerifierFactory.deploy();

    // Deploy Spend32Verifier
    const Spend32VerifierFactory = await ethers.getContractFactory(
        "Spend32Verifier"
    );
    const spend32Verifier = await Spend32VerifierFactory.deploy();

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
        spend11Verifier.target,
        spend12Verifier.target,
        spend13Verifier.target,
        spend21Verifier.target,
        spend22Verifier.target,
        spend23Verifier.target,
        spend31Verifier.target,
        spend32Verifier.target,
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
        spend11Verifier,
        spend12Verifier,
        spend13Verifier,
        spend21Verifier,
        spend22Verifier,
        spend23Verifier,
        spend31Verifier,
        spend32Verifier,
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
