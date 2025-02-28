// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interface/IRBFFactory.sol";
import "../interface/IEscrowFactory.sol";
import "../interface/IPriceFeedFactory.sol";
import "../interface/IRBFRouter.sol";
import "../common/Escrow.sol";
import "./RBF.sol";

/**
 * @author  tmpAuthor
 * @title   RBFRouter
 * @dev     Router contract for deploying RBF contracts and managing their settings.
 * @notice  This contract facilitates the creation and management of RBF contracts, handling escrow and price feed deployment.
 */
contract RBFRouter is IRBFRouter,Ownable {
    struct RBFInfo {
        uint256 createdAt;
        address rbf;
        address rbfProxyAdmin;
        address rbfImpl;
        address dividendTreasury;
        address priceFeed;
    }
    
    struct RBFDeployData {
        uint64 rbfId;
        string name;
        string symbol;
        address assetToken;
        uint256 maxSupply;
        uint256 manageFee;
        address depositTreasury;
        int256 initialPrice;
        address deployer;
        address manager;
        address guardian;
    }

    uint256 public threshold;
    uint64 public rbfNonce;
    IRBFFactory public immutable rbfFactory;
    IEscrowFactory public immutable escrowFactory;
    IPriceFeedFactory public immutable priceFeedFactory;
    mapping(uint64 => RBFInfo) private rbfs;
    mapping(address => bool) public whiteListed;

    /**
     * @notice Constructor to initialize the router with necessary parameters.
     * @dev Sets up the factories for RBF, escrow, and price feed while initializing the whitelist and threshold.
     * @param _whiteLists Array of addresses that are whitelisted for signing transactions.
     * @param _threshold Minimum number of valid signatures required.
     * @param _rbfFactory Address of the RBF factory.
     * @param _escrowFactory Address of the escrow factory.
     * @param _priceFeedFactory Address of the price feed factory.
     */
    constructor(
        address[] memory _whiteLists,
        uint256 _threshold,
        address _rbfFactory,
        address _escrowFactory,
        address _priceFeedFactory
    ) Ownable() {
        for (uint256 i = 0; i < _whiteLists.length; i++) {
            whiteListed[_whiteLists[i]] = true;
        }
        threshold = _threshold;
        rbfFactory = IRBFFactory(_rbfFactory);
        escrowFactory = IEscrowFactory(_escrowFactory);
        priceFeedFactory = IPriceFeedFactory(_priceFeedFactory);
    }

    /**
     * @notice  Deploys a new RBF contract after verifying signatures.
     * @dev     Decodes the deployment data, verifies signatures, and deploys the RBF contract along with escrow and price feed.
     * @param   deployData  Encoded data containing deployment parameters.
     * @param   signatures  Array of signatures for verification.
     */
    function deployRBF(
        bytes memory deployData,
        bytes[] memory signatures
    ) public {
        _verifySign(deployData, signatures);
        RBFDeployData memory rbfDeployData = abi.decode(
            deployData,
            (RBFDeployData)
        );
        require(rbfDeployData.rbfId == rbfNonce, "RBFRouter:Invalid rbfId");
        require(rbfDeployData.deployer == msg.sender, "RBFRouter:Invalid deployer");
        rbfNonce++;
        address dividendTreasury = escrowFactory.newEscrow(address(this));
        address pricerFeed = priceFeedFactory.newPriceFeed(
            msg.sender,
            rbfDeployData.initialPrice
        );
        RBFInitializeData memory data=RBFInitializeData({
            name:rbfDeployData.name,
            symbol:rbfDeployData.symbol,
            assetToken:rbfDeployData.assetToken,
            maxSupply:rbfDeployData.maxSupply,
            manageFee:rbfDeployData.manageFee,
            depositTreasury:rbfDeployData.depositTreasury,
            dividendTreasury:dividendTreasury,
            priceFeed:pricerFeed,
            manager:rbfDeployData.manager
        });
        (address rbf,address rbfProxyAdmin,address rbfImpl)= rbfFactory.newRBF(
            data,
            rbfDeployData.guardian
        );
        rbfs[rbfDeployData.rbfId] = RBFInfo(
            block.timestamp,
            rbf,
            rbfProxyAdmin,
            rbfImpl,
            address(dividendTreasury),
            address(pricerFeed)
        );

        Escrow(dividendTreasury).approveMax(rbfDeployData.assetToken,rbf);
        Escrow(dividendTreasury).rely(address(rbf));
        Escrow(dividendTreasury).deny(address(this));
        RBF(rbf).transferOwnership(msg.sender);
        emit DeployRBFEvent(
            rbfDeployData.rbfId,
            pricerFeed,
            rbf,
            dividendTreasury
        );

    }


    function _verifySign(
        bytes memory deployData,
        bytes[] memory signatures
    ) internal view {
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(
            keccak256(deployData)
        );
        uint256 validSignatures = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(ethSignedMessageHash, signatures[i]);
            require(whiteListed[signer], "RBFRouter:Invalid Signer");
            validSignatures++;
        }
        require(validSignatures >= threshold, "RBFRouter:Invalid Threshold");
    }
    
    function getEncodeData(
        RBFDeployData memory rbfDeployData
    ) public pure returns (bytes memory) {
        return abi.encode(rbfDeployData);
    }


    /**
     * @notice  Retrieves information about a deployed RBF contract.
     * @param   rbfId  rbfId The unique identifier of the RBF contract.
     * @return  RBFInfo  The corresponding RBFInfo struct.
     */
    function getRBFInfo(uint64 rbfId) public view returns (RBFInfo memory) {
        return rbfs[rbfId];
    }

    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) public pure returns (address) {
        require(signature.length == 65, "RBFRouter:Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        // 分割 r, s, v
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    function getEthSignedMessageHash(
        bytes32 messageHash
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    messageHash
                )
            );
    }

}
