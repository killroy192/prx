# PRX - Privacy-Preserving Payment System with Noir Circuits

A zero-knowledge proof-based privacy-preserving payment system built with Noir circuits and Plonk proofs, featuring smart contract integration for on-chain verification and UTXO-based transaction model.

## Overview

PRX implements a privacy-preserving payment system using zero-knowledge proofs and UTXO (Unspent Transaction Output) model. The system allows users to make transactions by proving the validity of their operations without revealing sensitive information like amounts, while maintaining full privacy through commitment schemes.

## Architecture

The project consists of several key components:

### Circuits
- **Deposit Circuit**: Handles the creation and verification of payment commitments for deposits
- **Spend Circuits**: Manage the spending of committed funds with various input/output configurations:
  - `spend_11`: 1 input, 1 output
  - `spend_12`: 1 input, 2 outputs  
  - `spend_13`: 1 input, 3 outputs
  - `spend_21`: 2 inputs, 1 output
  - `spend_22`: 2 inputs, 2 outputs
  - `spend_23`: 2 inputs, 3 outputs
  - `spend_31`: 3 inputs, 1 output
  - `spend_32`: 3 inputs, 2 outputs
- **Commitment Library**: Core utilities for commitment creation and verification using Poseidon hashing

### Smart Contracts
- **Vault.sol**: Main contract managing deposits, withdrawals, and spending operations
- **Verifier Contracts**: Solidity contracts that verify zero-knowledge proofs on-chain for each circuit
- **PoseidonWrapper.sol**: On-chain Poseidon hash computation utilities
- **MockERC20.sol**: Test token for development and testing

## Features

- 🔐 **Zero-Knowledge Proofs**: Privacy-preserving transaction validation using Plonk
- 🏗️ **UTXO Model**: Unspent Transaction Output system for privacy
- ⛓️ **On-Chain Verification**: Smart contract integration for proof verification
- 🧪 **Comprehensive Testing**: Full test suite for circuit and contract functionality
- 🛠️ **Development Tools**: Automated compilation and deployment scripts
- 🔄 **Multiple Transaction Types**: Support for various input/output combinations
- 🚀 **Deployment Ready**: Configurable deployment for multiple networks (Hardhat, localhost, Optimism Sepolia)
- 🛡️ **Security Features**: Reentrancy protection, signature verification, and access controls

## Project Structure

```
prx/
├── circuits/                    # Noir circuit implementations
│   ├── commitment/              # Core commitment utilities
│   ├── deposit/                 # Deposit circuit
│   └── spend_{inputs-outputs}/  # Spend circuit variants (11, 12, 13, 21, 22, 23, 31, 32)
├── contracts/                   # Solidity smart contracts
│   ├── Vault.sol               # Main vault contract
│   ├── *Verifier.sol           # ZK proof verifier contracts
│   ├── PoseidonWrapper.sol     # Poseidon hash utilities
│   └── MockERC20.sol           # Test token
├── test/                       # Integration and unit tests
│   ├── circuits/               # Circuit-specific tests
│   ├── fixtures/               # Test fixtures and deployment helpers
│   └── utils/                  # Test utilities
├── utils/                      # Utility scripts and helpers
│   ├── compile.sh              # Circuit compilation script
│   ├── commitment.ts           # Commitment generation utilities
│   └── poseidon.ts             # Poseidon hash utilities
├── deployment.config.ts        # Deployment configuration
└── hardhat.config.ts           # Hardhat configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Noir CLI - [Installation Guide](https://noir-lang.org/getting_started/installation/)
- Barretenberg (bb) - Required for circuit compilation and proof generation

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd prx
```

2. Install dependencies:
```bash
npm install
```

3. Compile the circuits:
```bash
npm run compile
```

### Usage

#### Running Tests
```bash
npm test
```

#### Compiling Circuits
```bash
npm run compile
```

#### Generating Commitments
```bash
npm run comt <value>
```

#### Starting Local Blockchain
```bash
npm run chain
```

#### Deployment
```bash
# Deploy to Hardhat network (for testing)
npm run deploy:hh

# Deploy to localhost
npm run deploy:localhost
```

## Circuit Details

### Deposit Circuit
The deposit circuit verifies the creation of payment commitments for deposits. It:
- Takes 3 commitments and their corresponding Poseidon hashes
- Verifies each commitment using Poseidon hashing
- Ensures the total amount matches the sum of individual commitments
- Validates commitment integrity and uniqueness

### Spend Circuits
The spend circuits handle the spending of committed funds with various configurations. They:
- Verify input and output commitments
- Ensure amount conservation (total input = total output)
- Maintain privacy by not revealing actual amounts
- Support different input/output combinations for flexible transaction types

### Commitment System
The commitment system uses:
- **Poseidon Hashing**: For efficient zero-knowledge proof-friendly hashing
- **Amount + Entropy**: Each commitment contains an amount and random entropy
- **Hash Verification**: On-chain verification of commitment integrity
- **UTXO Model**: Each commitment represents an unspent transaction output

## Smart Contract Integration

### Vault Contract
The main `Vault.sol` contract provides:
- **Deposit Functionality**: Accept tokens with ZK proof validation
- **Spend Operations**: Process transactions with various input/output combinations
- **Withdrawal System**: Emergency and regular withdrawal mechanisms
- **Commitment Management**: Track UTXO commitments and their states
- **Signature Verification**: ECDSA signature validation for transaction authorization

### Verifier Contracts
Each circuit has a corresponding verifier contract that:
- Accepts zero-knowledge proofs as input
- Verifies proof validity on-chain using Plonk
- Integrates with the Noir circuit outputs
- Provides gas-efficient verification

## Development

### Adding New Circuits
1. Create a new directory in `circuits/` following the naming convention `spend_{inputs}_{outputs}`
2. Implement your circuit logic in Noir
3. Add compilation to `utils/compile.sh`
4. Create corresponding verifier contract
5. Update `deployment.config.ts` with new verifier
6. Add tests in `test/circuits/`

### Testing
The test suite includes:
- **Circuit Tests**: Individual circuit functionality validation
- **Integration Tests**: End-to-end workflow validation
- **Contract Tests**: Smart contract functionality and security
- **Emergency Scenarios**: Withdrawal and emergency procedures

### Deployment Configuration
The project supports deployment to multiple networks:
- **Hardhat**: For development and testing
- **Localhost**: For local blockchain testing
- **Optimism Sepolia**: For testnet deployment

Configure deployment in `deployment.config.ts` and use environment variables for sensitive data.

## Technologies Used

- **Noir**: Zero-knowledge circuit programming language
- **Plonk**: Zero-knowledge proof system with Barretenberg backend
- **Hardhat**: Ethereum development framework with deployment bundling
- **TypeScript**: Development language for tests and utilities
- **Poseidon**: Zero-knowledge friendly hash function
- **OpenZeppelin**: Secure smart contract libraries
- **Ethers.js**: Ethereum interaction library

## Security Features

- **Reentrancy Protection**: Guards against reentrancy attacks
- **Signature Verification**: ECDSA signature validation for transaction authorization
- **Access Controls**: Ownable pattern for administrative functions
- **Input Validation**: Comprehensive parameter validation
- **Commitment Uniqueness**: Prevents double-spending of commitments

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Author

Dzmitry Lahunouski <killroy192@gmail.com>
