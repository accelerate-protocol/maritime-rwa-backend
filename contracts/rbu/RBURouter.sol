// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interface/IRBUTokenFactory.sol";
import "../interface/IRBUManagerFactory.sol";
import "../interface/IEscrowFactory.sol";
import "../interface/IPricerFactory.sol";
import "./RBUManager.sol";
import "../common/Escrow.sol";
import "./RBUToken.sol";
struct RBUInfo {
    uint256 createdAt;
    address rbuManager;
    address withdrawTreasury;
    address dividendTreasury;
    address rbuToken;
    address rbuPrice;
}

struct RBUDeployData {
    uint64 rbuId;
    string name;
    string symbol;
    address assetToken;
    uint256 maxSupply;
    uint256 activeStartTime;
    uint256 activeEndTime;
    uint256 minDepositAmount;
    uint256 managerFee;
    address depositTreasury;
    uint256 initialPrice;
    address deployer;
    address manager;
}

contract RBURouter is Ownable {
    event DeployRBUEvent(
        uint64 rbuId,
        address rbuToken,
        address rbuPrice,
        address rbuManager,
        address escrow,
        address dividendTreasury
    );

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);

    uint256 public threshold;
    uint64 public rbuNonce;
    IRBUTokenFactory public rbuTokenFactory;
    IRBUManagerFactory public rbuManagerFactory;
    IEscrowFactory public escrowFactory;
    IPricerFactory public pricerFactory;

    mapping(uint64 => RBUInfo) internal rbus;
    mapping(address => bool) public whiteListed;

    constructor(
        address[] memory _whiteLists,
        uint256 _threshold,
        address _rbuTokenFactory,
        address _rbuManagerFactory,
        address _escrowFactory,
        address _pricerFactory
    ) Ownable() {
        for (uint256 i = 0; i < _whiteLists.length; i++) {
            whiteListed[_whiteLists[i]] = true;
        }
        threshold = _threshold;
        rbuTokenFactory = IRBUTokenFactory(_rbuTokenFactory);
        rbuManagerFactory = IRBUManagerFactory(_rbuManagerFactory);
        escrowFactory = IEscrowFactory(_escrowFactory);
        pricerFactory = IPricerFactory(_pricerFactory);
    }

    function getRbuNonce() public view returns (uint64) {
        return rbuNonce;
    }

    function deployRBU(
        bytes memory deployData,
        bytes[] memory signatures
    ) public {
        _verifySign(deployData, signatures);
        RBUDeployData memory rbuDeployData = abi.decode(
            deployData,
            (RBUDeployData)
        );
        require(rbuDeployData.rbuId == rbuNonce, "Invalid rbuId");
        require(rbuDeployData.deployer == msg.sender, "Invalid deployer");

        address withdrawTreasury = escrowFactory.newEscrow(address(this));
        address dividendTreasury = escrowFactory.newEscrow(address(this));
        address rbuManager = rbuManagerFactory.newRBUManager(
            rbuDeployData.assetToken,
            rbuDeployData.maxSupply,
            rbuDeployData.depositTreasury,
            withdrawTreasury,
            dividendTreasury,
            rbuDeployData.manager
        );
        RBUManager(rbuManager).setActiveTime(
            rbuDeployData.activeStartTime,
            rbuDeployData.activeEndTime
        );
        RBUManager(rbuManager).setMinDepositAmount(
            rbuDeployData.minDepositAmount
        );
        RBUManager(rbuManager).setManagerFee(rbuDeployData.managerFee);

        address pricer = pricerFactory.newPricer(
            msg.sender,
            rbuDeployData.initialPrice
        );
        address rbuToken = rbuTokenFactory.newRBUToken(
            rbuDeployData.name,
            rbuDeployData.symbol,
            rbuManager
        );

        RBUManager(rbuManager).setRBUToken(rbuToken, pricer);

        rbus[rbuDeployData.rbuId] = RBUInfo(
            block.timestamp,
            address(rbuManager),
            address(withdrawTreasury),
            address(dividendTreasury),
            address(rbuToken),
            address(pricer)
        );

        Escrow(withdrawTreasury).approveMax(rbuDeployData.assetToken, rbuManager);
        Escrow(withdrawTreasury).rely(address(rbuManager));
        Escrow(withdrawTreasury).deny(address(this));
        Escrow(dividendTreasury).approveMax(
            rbuDeployData.assetToken,
            rbuManager
        );
        Escrow(dividendTreasury).rely(address(rbuManager));
        Escrow(dividendTreasury).deny(address(this));
        RBUManager(rbuManager).transferOwnership(msg.sender);

        rbuNonce++;
        emit DeployRBUEvent(
            rbuDeployData.rbuId,
            rbuToken,
            pricer,
            rbuManager,
            withdrawTreasury,
            dividendTreasury
        );
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
            require(whiteListed[signer], "Invalid signer");
            validSignatures++;
        }
        require(validSignatures >= threshold, "Invalid threshold");
    }

    function verify(
        address addr,
        bytes memory deployData,
        bytes memory sign
    ) public pure returns (bool) {
        address signer = recoverSigner(
            getEthSignedMessageHash(keccak256(deployData)),
            sign
        );
        return signer == addr;
    }

    function getEncodeData(
        RBUDeployData memory rbuDeployData
    ) public pure returns (bytes memory) {
        return abi.encode(rbuDeployData);
    }

    function getRBUInfo(uint64 rbuId) public view returns (RBUInfo memory) {
        return rbus[rbuId];
    }

    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) public pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

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

    function isInWhiteListed(address _address) public view returns (bool) {
        return whiteListed[_address];
    }
}
