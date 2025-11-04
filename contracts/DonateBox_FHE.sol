pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DonateBox_FHE is ZamaEthereumConfig {
    
    struct DonationBox {
        string projectTitle;                    
        euint32 encryptedTotal;        
        uint256 publicGoal;          
        uint256 publicDeadline;          
        string description;            
        address creator;               
        uint256 timestamp;             
        uint32 decryptedTotal; 
        bool isVerified; 
    }
    

    mapping(string => DonationBox) public donationBoxes;
    
    string[] public projectIds;
    
    event DonationBoxCreated(string indexed projectId, address indexed creator);
    event DecryptionVerified(string indexed projectId, uint32 decryptedTotal);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function createDonationBox(
        string calldata projectId,
        string calldata projectTitle,
        externalEuint32 encryptedTotal,
        bytes calldata inputProof,
        uint256 publicGoal,
        uint256 publicDeadline,
        string calldata description
    ) external {
        require(bytes(donationBoxes[projectId].projectTitle).length == 0, "Project already exists");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedTotal, inputProof)), "Invalid encrypted input");
        
        donationBoxes[projectId] = DonationBox({
            projectTitle: projectTitle,
            encryptedTotal: FHE.fromExternal(encryptedTotal, inputProof),
            publicGoal: publicGoal,
            publicDeadline: publicDeadline,
            description: description,
            creator: msg.sender,
            timestamp: block.timestamp,
            decryptedTotal: 0,
            isVerified: false
        });
        
        FHE.allowThis(donationBoxes[projectId].encryptedTotal);
        
        FHE.makePubliclyDecryptable(donationBoxes[projectId].encryptedTotal);
        
        projectIds.push(projectId);
        
        emit DonationBoxCreated(projectId, msg.sender);
    }
    
    function verifyDecryption(
        string calldata projectId, 
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(donationBoxes[projectId].projectTitle).length > 0, "Project does not exist");
        require(!donationBoxes[projectId].isVerified, "Data already verified");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(donationBoxes[projectId].encryptedTotal);
        
        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        
        donationBoxes[projectId].decryptedTotal = decodedValue;
        donationBoxes[projectId].isVerified = true;
        
        emit DecryptionVerified(projectId, decodedValue);
    }
    
    function getEncryptedTotal(string calldata projectId) external view returns (euint32) {
        require(bytes(donationBoxes[projectId].projectTitle).length > 0, "Project does not exist");
        return donationBoxes[projectId].encryptedTotal;
    }
    
    function getDonationBox(string calldata projectId) external view returns (
        string memory projectTitle,
        uint256 publicGoal,
        uint256 publicDeadline,
        string memory description,
        address creator,
        uint256 timestamp,
        bool isVerified,
        uint32 decryptedTotal
    ) {
        require(bytes(donationBoxes[projectId].projectTitle).length > 0, "Project does not exist");
        DonationBox storage data = donationBoxes[projectId];
        
        return (
            data.projectTitle,
            data.publicGoal,
            data.publicDeadline,
            data.description,
            data.creator,
            data.timestamp,
            data.isVerified,
            data.decryptedTotal
        );
    }
    
    function getAllProjectIds() external view returns (string[] memory) {
        return projectIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}


