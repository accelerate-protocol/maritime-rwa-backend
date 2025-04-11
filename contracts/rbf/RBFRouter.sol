// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interface/IRBFFactory.sol";
import "../interface/IEscrowFactory.sol";
import "../interface/IPriceFeedFactory.sol";
import "../interface/IRBFRouter.sol";
import "../common/Escrow.sol";
import "./RBF.sol";

/**
 * @author  Accelerate Finance
 * @title   RBFRouter
 * @dev     Router contract for deploying RBF contracts and managing their settings.
 * @notice  This contract facilitates the creation and management of RBF contracts, handling escrow and price feed deployment.
 */
contract RBFRouter is IRBFRouter, Ownable {
    // Struct to store RBF contract information
    struct RBFInfo {
        uint256 createdAt; // Timestamp when the RBF contract was created
        address rbf; // Address of the deployed RBF contract
        address rbfProxyAdmin; // Address of the RBF proxy admin
        address rbfImpl; // Address of the RBF implementation contract
        address dividendTreasury; // Address of the dividend treasury escrow contract
        address priceFeed; // Address of the associated price feed contract
    }

    // Struct to hold data for deploying an RBF contract
    struct RBFDeployData {
        uint64 rbfId; // Unique identifier for the RBF contract
        string name; //Name of the RBF token
        string symbol; //Symbol of the RBF token
        address assetToken; //Address of the asset backing the RBF
        address depositTreasury; //Address of the deposit treasury
        address deployer; //Address of the deployer
        address manager; //Address of the RBF and PriceFeed manager
        address guardian; //Guardian address for security proxy update
    }

    // Minimum number of valid signatures required for deployment
    uint256 public threshold;
    // Nonce for tracking RBF contract deployments
    uint64 public rbfNonce;
    // Immutable factory contract addresses for RBF, escrow, and price feeds
    IRBFFactory public immutable rbfFactory;
    IEscrowFactory public immutable escrowFactory;
    IPriceFeedFactory public immutable priceFeedFactory;
    // Mapping of RBF ID to its corresponding contract information
    mapping(uint64 => RBFInfo) private rbfs;
    // Mapping to track whitelisted addresses authorized to sign transactions
    mapping(address => bool) public whiteListed;
    address[] public whiteLists;

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
        require(_whiteLists.length > 0, "whiteLists must not be empty");//tc-21:白名单为空
        whiteLists = _whiteLists;
        for (uint256 i = 0; i < _whiteLists.length; i++) {
            whiteListed[_whiteLists[i]] = true;
        }
        require(_threshold > 0, "threshold must >0");//tc-21:阈值为0
        threshold = _threshold;
        require(_rbfFactory != address(0), "rbfFactory must not be zero");//tc-21:RBFFactory地址为零地址
        rbfFactory = IRBFFactory(_rbfFactory);
        require(_escrowFactory != address(0), "escrowFactory must not be zero");//tc-21:EscrowFactory地址为零地址
        escrowFactory = IEscrowFactory(_escrowFactory);
        require(
            _priceFeedFactory != address(0),
            "priceFeedFactory must not be zero"//tc-21:PriceFeedFactory地址为零地址
        );
        priceFeedFactory = IPriceFeedFactory(_priceFeedFactory);
    }


    /**
     * @notice  Updates the whitelist of authorized signers and the signature threshold.
     * @dev     Only the contract owner can call this function. It first clears the existing whitelist,
     *          then sets the new whitelist addresses and updates the required signature threshold.
     * @param   _whiteLists  Array of new addresses to be whitelisted.
     * @param   _threshold  Minimum number of valid signatures required for verification.
     */
     //tc-19:设置阈值和白名单成功且生效
    function setWhiteListsAndThreshold(
        address[] memory _whiteLists,
        uint256 _threshold
    ) public onlyOwner {
        require(_whiteLists.length > 0, "whiteLists must not be empty");//tc-19:设置签名白名单为null，失败
        require(_threshold > 0, "threshold must not be zero");//tc-19:设置阈值为0，失败
        // Remove existing whitelist addresses
        uint oldLen=whiteLists.length;
        for (uint i = 0; i < oldLen; i++) {
            whiteListed[whiteLists[i]] = false;
        }

        // Update whitelist addresses
        whiteLists = _whiteLists;
        uint newLen=_whiteLists.length;
        for (uint256 i = 0; i < newLen; i++) {
            whiteListed[_whiteLists[i]] = true;
        }
        // Update the required signature threshold
        threshold = _threshold;

        emit SetWhiteListsAndThreshold(_whiteLists, _threshold);
    }

    /**
     * @notice  Deploys a new RBF contract after verifying signatures.
     * @dev     Decodes the deployment data, verifies signatures, and deploys the RBF contract along with escrow and price feed.
     * @param   deployData  Encoded data containing deployment parameters.
     * @param   signatures  Array of signatures for verification.
     */
     //tc-1:当前未给RBFRouter授权，应该不能部署RBF
     //tc-1:给RBFRouter仅授权EscrowFactory调用权限后，部署RBF，应该部署失败
     //tc-1:给RBFRouter仅授权EscrowFactory、PriceFeedFactory调用权限后，部署RBF，应该部署失败
     //tc-1:给RBFRouter授权RBFFactory、EscrowFactory、PriceFeedFactory调用权限后，且各参数满足要求，部署RBF，应该部署成功
    function deployRBF(
        bytes memory deployData,
        bytes[] memory signatures
    ) public {
        _verifySign(deployData, signatures);

        RBFDeployData memory rbfDeployData = abi.decode(
            deployData,
            (RBFDeployData)
        );
        require(rbfDeployData.rbfId == rbfNonce, "RBFRouter:Invalid rbfId"); //tc-13：rbfId等于Nounce-1，部署失败；//tc-13:rbfId等于Nounce+1，部署失败；//tc-13:
        require(
            rbfDeployData.deployer == msg.sender,
            "RBFRouter:Invalid deployer" //tc-16:部署RBF时，消息发送者与deploydata中的deployer不一致，部署失败报错
        );
        rbfNonce++;
        address dividendTreasury = escrowFactory.newEscrow(address(this));
        address pricerFeed = priceFeedFactory.newPriceFeed(
            rbfDeployData.manager
        );
        RBFInitializeData memory data = RBFInitializeData({
            name: rbfDeployData.name,
            symbol: rbfDeployData.symbol,
            assetToken: rbfDeployData.assetToken,
            depositTreasury: rbfDeployData.depositTreasury,
            dividendTreasury: dividendTreasury,
            priceFeed: pricerFeed,
            manager: rbfDeployData.manager
        });
        (address rbf, address rbfProxyAdmin, address rbfImpl) = rbfFactory
            .newRBF(data, rbfDeployData.guardian);
        rbfs[rbfDeployData.rbfId] = RBFInfo(
            block.timestamp,
            rbf,
            rbfProxyAdmin,
            rbfImpl,
            address(dividendTreasury),
            address(pricerFeed)
        );
        Escrow(dividendTreasury).approveMax(rbfDeployData.assetToken, rbf);
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
            require(whiteListed[signer], "RBFRouter:Invalid Signer"); //tc-12：使用不在签名白名单中的账户签名，部署RBF失败报错
            validSignatures++;
        }
        require(validSignatures >= threshold, "RBFRouter:Invalid Threshold"); //tc-19：签名个数小于阈值，部署失败；//tc-19:签名个数等于阈值，部署成功
    }

    /**
     * @notice  Retrieves information about a deployed RBF contract.
     * @param   rbfId  rbfId The unique identifier of the RBF contract.
     * @return  RBFInfo  The corresponding RBFInfo struct.
     */
    function getRBFInfo(uint64 rbfId) public view returns (RBFInfo memory) {
        return rbfs[rbfId];
    }

    /**
     * @notice  Returns the length of the whiteLists array.
     * @dev     This function is used to get the length of the whiteLists array.
     * @return  uint256  The length of the whiteLists array.
     */
    function getWhiteListsLen() public view returns (uint256) {
        return whiteLists.length;
    }


    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) internal pure returns (address) {
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
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    messageHash
                )
            );
    }
}
