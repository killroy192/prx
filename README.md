# PRX - Privacy-Preserving Payment System with Noir Circuits

A zero-knowledge proof-based privacy-preserving payment system built with Noir circuits and Plonk proofs, featuring smart contract integration for on-chain verification.

## Overview

PRX implements a privacy-preserving payment system using zero-knowledge proofs. The system allows users to make private transactions by proving the validity of their operations without revealing sensitive information like amounts or transaction details.

## Architecture

The project consists of several key components:

### Circuits
- **Deposit Circuit**: Handles the creation and verification of payment commitments
- **Spend Circuits**: Manage the spending of committed funds with various configurations
- **Commitment Library**: Core utilities for commitment creation and verification using Poseidon hashing

### Smart Contracts
- **Verifier Contracts**: Solidity contracts that verify zero-knowledge proofs on-chain
- **Integration**: Seamless integration between Noir circuits and Ethereum smart contracts

## Features

- 🔐 **Zero-Knowledge Proofs**: Privacy-preserving transaction validation
- 🏗️ **Modular Circuit Design**: Reusable commitment and verification logic
- ⛓️ **On-Chain Verification**: Smart contract integration for proof verification
- 🧪 **Comprehensive Testing**: Full test suite for circuit and contract functionality
- 🛠️ **Development Tools**: Automated compilation and deployment scripts

## Project Structure

```
prx/
├── circuits/                 # Noir circuit implementations
│   ├── commitment/          # Core commitment utilities
│   ├── deposit/            # Deposit circuit
│   ├── spend_11/           # Spend circuit variant 1
│   ├── spend_12/           # Spend circuit variant 2
│   ├── spend_21/           # Spend circuit variant 3
│   └── spend_22/           # Spend circuit variant 4
├── contracts/              # Solidity verifier contracts
├── test/                   # Integration tests
├── utils/                  # Utility scripts and helpers
└── artifacts/              # Compiled circuit artifacts
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Noir CLI - [Installation Guide](https://noir-lang.org/getting_started/installation/)

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
npm run comt
```

## Circuit Details

### Deposit Circuit
The deposit circuit verifies the creation of payment commitments. It:
- Takes multiple commitments and their corresponding hashes
- Verifies each commitment using Poseidon hashing
- Ensures the total amount matches the sum of individual commitments

### Spend Circuits
The spend circuits handle the spending of committed funds. They:
- Verify input and output commitments
- Ensure amount conservation (input = output)
- Maintain privacy by not revealing actual amounts

### Commitment System
The commitment system uses:
- **Poseidon Hashing**: For efficient zero-knowledge proof-friendly hashing
- **Amount + Entropy**: Each commitment contains an amount and random entropy
- **Hash Verification**: On-chain verification of commitment integrity

## Smart Contract Integration

The project includes Solidity verifier contracts that:
- Accept zero-knowledge proofs as input
- Verify proof validity on-chain
- Integrate with the Noir circuit outputs

## Development

### Adding New Circuits
1. Create a new directory in `circuits/`
2. Implement your circuit logic in Noir
3. Add compilation to `utils/compile.sh`
4. Create corresponding verifier contract
5. Add tests

### Testing
The test suite includes:
- Circuit functionality tests
- Smart contract integration tests
- End-to-end workflow validation

## Technologies Used

- **Noir**: Zero-knowledge circuit programming language
- **Plonk**: Zero-knowledge proof system
- **Hardhat**: Ethereum development framework
- **TypeScript**: Development language
- **Poseidon**: Zero-knowledge friendly hash function

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Author

Dzmitry Lahunouski <killroy192@gmail.com>
