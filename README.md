# Confidential Donation Box

Confidential Donation Box is a privacy-preserving application that empowers charitable giving through the power of Zama's Fully Homomorphic Encryption (FHE). Our platform ensures that donor identities and contributions remain confidential while transparently displaying project progress, fostering trust and integrity in charitable donations.

## The Problem

In today's digital landscape, the need for privacy and security in philanthropic endeavors has never been more crucial. Traditional donation systems often expose sensitive information, including donor identities and contributions, rendering this data vulnerable to misuse. This lack of privacy can discourage potential donors from contributing, ultimately hindering the funding of valuable social projects. Without the protection offered by advanced encryption technologies, sensitive data can be exploited, leading to breaches of trust and privacy.

## The Zama FHE Solution

Zama's Fully Homomorphic Encryption provides the robust privacy framework necessary to address these challenges. By enabling computations on encrypted data, we ensure that donor information remains confidential throughout the donation process. Our application utilizes fhevm to handle encrypted inputs and perform calculations on donor contributions without ever revealing the underlying data. This ensures that while total contributions are visible, individual donor details remain securely encrypted, safeguarding their privacy.

## Key Features

- 🔒 **Confidential Transactions**: Donor identities and contribution amounts are always encrypted, guaranteeing privacy.
- 📊 **Transparent Progress Tracking**: Stakeholders can view project progress without compromising donor confidentiality.
- 💪 **Decentralized Architecture**: Leveraging blockchain technology for a secure, trustworthy donation experience.
- 🌐 **User-Friendly Interface**: Designed with simplicity in mind, making donations easy and accessible for everyone.
- 🌟 **Automatic Updates**: Ongoing contributions are updated in real-time, ensuring accurate progress tracking while maintaining privacy.

## Technical Architecture & Stack

Our application is built on a robust stack that emphasizes security, privacy, and usability:

- **Core Privacy Engine**: Zama's FHE (via fhevm)
- **Blockchain Layer**: Ethereum, ensuring decentralized and secure transaction processing
- **Frontend**: React, providing an intuitive user experience
- **Backend**: Node.js and Express for handling API requests
- **Database**: MongoDB for storing project and contribution data securely

This combination of technologies allows us to create a powerful, privacy-focused donation platform that is both transparent and secure.

## Smart Contract / Core Logic

Here is a simplified Solidity snippet demonstrating how contributions might be processed within our smart contract using Zama's TFHE functionalities:solidity
pragma solidity ^0.8.0;

import "TFHE.sol";

contract DonationBox {
    mapping(address => uint256) private contributions;

    event ContributionReceived(address indexed contributor, uint256 amount);

    function donate(uint64 encryptedAmount) public {
        uint256 decryptedAmount = TFHE.decrypt(encryptedAmount);
        contributions[msg.sender] += decryptedAmount;
        emit ContributionReceived(msg.sender, decryptedAmount);
    }

    function getTotalContributions() public view returns (uint256) {
        uint256 total = 0;
        // Logic to compute total contributions without decrypting individual amounts
        return total;
    }
}

This example showcases how encrypted donations are decrypted for processing while preserving donor confidentiality.

## Directory Structure

The project follows a structured directory layout to facilitate easy navigation and understanding:
ConfidentialDonationBox/
├── contracts/                     # Smart contracts
│   └── donationBox.sol            # Donation Box smart contract
├── src/                           # Frontend application source
│   ├── components/                # React components
│   ├── App.js                     # Main App component
│   └── index.js                   # Application entry point
├── server/                        # Backend API source
│   ├── app.js                     # Main server file
│   └── routes/                    # API route definitions
│       └── donations.js           # Donations API
├── .env                           # Environment variables
└── README.md                      # Project documentation

This organized structure ensures clarity and maintainability, making it easy for developers to contribute or modify the codebase.

## Installation & Setup

To get started with the Confidential Donation Box, follow these prerequisites and installation instructions:

### Prerequisites

- Node.js and npm
- A compatible Ethereum wallet (e.g., MetaMask)
- MongoDB instance
- A development environment for Solidity smart contracts

### Installation Instructions

1. **Install Dependencies**:  
   In your terminal, navigate to the project root and execute the following commands:bash
   npm install express mongoose react
   npm install fhevm

2. **Setup Smart Contract**:  
   Navigate to the `contracts` directory and compile the smart contracts using:bash
   npx hardhat compile

3. **Run the Server**:  
   Start the backend server with:bash
   node server/app.js

4. **Initialize Frontend**:  
   Start the frontend application in a separate terminal:bash
   npm start

Ensure you have your environment variables configured correctly for your MongoDB and Ethereum wallet.

## Build & Run

Once you've installed the necessary dependencies and set up your environment, you can follow these commands to build and run the application:

1. **Compile Smart Contracts**:bash
   npx hardhat compile

2. **Run the Backend Server**:bash
   node server/app.js

3. **Start the Frontend Application**:bash
   npm start

Navigate to the appropriate URL in your browser to access the Confidential Donation Box application.

## Acknowledgements

We would like to extend our heartfelt gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their cutting-edge technologies empower developers to build secure and privacy-focused applications that foster trust and transparency in digital transactions.

---

This README serves as a comprehensive guide to understanding, setting up, and contributing to the Confidential Donation Box project. Your engagement and contributions are what make this initiative a success. Thank you for your interest, and happy coding!


