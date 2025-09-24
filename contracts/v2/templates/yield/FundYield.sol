// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../../interfaces/templates/IFundVault.sol";
import "../../interfaces/templates/IFundYield.sol";

contract FundYield is
    IFundYield,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant SETTLE_ROLE = keccak256("SETTLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");


    address public vault;
    address public shareToken;
    address public rewardToken;
    uint256 public minRedemptionAmount;
    uint256 public startTime;
    uint256 public currentEpochId;
    uint256 public lockedShareToken;
    
    // Initialization state
    bool public initialized;

    mapping(address => mapping(uint256 => RedemptionRequest)) public redemptionEpochRequests;
    mapping(uint256 => RedemptionEpoch) public redemptionEpochs;


    modifier active() {
        require(block.timestamp >= startTime, "FundYield not started");
        _;
    }
    
    modifier onlyInitialized() {
        require(initialized, "FundYield: not initialized");
        _;
    }

    // ============ Constructor ============
    /**
     * @dev  Constructor function to disable initializers
     */
    constructor() {
        _disableInitializers();
    }

    // ============ Initialization Function ============
    /**
     * @dev Unified initialization interface
     * @param _vault Vault address
     * @param _vaultToken Vault token address
     * @param _initData Encoded initialization data (contains token and original initData)
     */
    function initiate(
        address _vault,
        address _vaultToken,
        bytes memory _initData
    ) external initializer {
        (
            address _rewardToken,
            address _manager,
            address _settleCaller,
            uint256 _minRedemptionAmount,
            uint256 _startTime
        ) = abi.decode(
                _initData,
                (address, address, address, uint256, uint256)
            );
        _init(
            _vault,
            _vaultToken,
            _rewardToken,
            _manager,
            _settleCaller,
            _minRedemptionAmount,
            _startTime
        );
    }

    function requestRedemption(
        uint256 shareAmount
    ) external active onlyInitialized nonReentrant whenNotPaused {
        require(
            shareAmount >= minRedemptionAmount,
            "FundYield:Below minimum redemption amount"
        );
        SafeERC20.safeTransferFrom(
            IERC20(shareToken),
            msg.sender,
            address(this),
            shareAmount
        );
        RedemptionEpoch storage epoch = redemptionEpochs[currentEpochId];
        require(
            epoch.epochStatus == EpochStatus.NotActive ||
                epoch.epochStatus == EpochStatus.Active,
            "FundYield:Epoch not in active or not active state"
        );
        if (epoch.epochStatus == EpochStatus.NotActive) {
            epoch.epochStatus = EpochStatus.Active;
        }
        epoch.totalShares += shareAmount;
        RedemptionRequest storage request = redemptionEpochRequests[msg.sender][
            currentEpochId
        ];
        request.requestShares += shareAmount;
        request.lastRequestTimeStamp = block.timestamp;
        emit RedemptionRequested(msg.sender, currentEpochId, shareAmount);
    }

    function changeEpoch()
        external
        active
        onlyInitialized
        nonReentrant
        whenNotPaused
        onlyRole(MANAGER_ROLE)
    {
        RedemptionEpoch storage epoch = redemptionEpochs[currentEpochId];
        require(
            epoch.epochStatus == EpochStatus.NotActive ||
                epoch.epochStatus == EpochStatus.Active,
            "FundYield:Epoch can not be locked"
        );
        if (epoch.epochStatus == EpochStatus.Active) {
            if (epoch.totalShares == 0) {
                epoch.epochStatus = EpochStatus.NotActive;
            }else{
                lockedShareToken+=epoch.totalShares;
                epoch.epochStatus = EpochStatus.Lock;
            }
        }
        currentEpochId += 1;
        emit RedemptionEpochChanged(currentEpochId);
    }

    function cancelRedemption() external active onlyInitialized nonReentrant whenNotPaused {
        RedemptionEpoch storage epoch = redemptionEpochs[currentEpochId];
        require(
            epoch.epochStatus == EpochStatus.Active,
            "FundYield:Epoch must be active"
        );
        RedemptionRequest storage request = redemptionEpochRequests[msg.sender][
            currentEpochId
        ];
        require(
            request.requestShares > 0,
            "FundYield:Insufficient shares to cancel"
        );
        uint256 shareAmount = request.requestShares;
        epoch.totalShares -= shareAmount;
        request.requestShares -= shareAmount;
        request.lastRequestTimeStamp = block.timestamp;
        SafeERC20.safeTransfer(IERC20(shareToken), msg.sender, shareAmount);
        emit RedemptionCancelled(msg.sender, currentEpochId, shareAmount);
    }

    function finishRedemptionEpoch(
        uint256 epochId,
        uint256 assetAmount,
        bytes memory signature
    )
        external
        active
        onlyInitialized
        nonReentrant
        whenNotPaused
        onlyRole(SETTLE_ROLE)
    {
        _verifySignature(epochId, assetAmount, signature);
        RedemptionEpoch storage epoch = redemptionEpochs[epochId];
        require(
            epoch.epochStatus == EpochStatus.Lock,
            "FundYield:Epoch must be locked"
        );
        epoch.totalRedemptionAssets = assetAmount;
        epoch.epochStatus = EpochStatus.Liquidate;
        SafeERC20.safeTransferFrom(
            IERC20(rewardToken),
            msg.sender,
            address(this),
            assetAmount
        );
        emit RedemptionEpochLiquidated(
            msg.sender,
            epochId,
            assetAmount,
            signature
        );
    }

    function claimRedemption(
        uint256 epochId
    ) external active onlyInitialized nonReentrant whenNotPaused {
        RedemptionEpoch storage epoch = redemptionEpochs[epochId];
        RedemptionRequest storage request = redemptionEpochRequests[msg.sender][
            epochId
        ];
        require(
            epoch.epochStatus == EpochStatus.Liquidate &&
                request.requestShares > 0,
            "FundYield:Epoch not liquidated or no redemption request"
        );
        require(
            request.claimShares == 0,
            "FundYield:request share already claimed"
        );
        request.claimShares = request.requestShares;
        uint256 claimAssets = (request.requestShares *
            epoch.totalRedemptionAssets) / epoch.totalShares;
        request.claimAssets = claimAssets;
        request.lastClaimTimeStamp = block.timestamp;
        epoch.totalClaimedAssets += claimAssets;
        lockedShareToken-=request.requestShares;
        SafeERC20.safeTransfer(IERC20(rewardToken), msg.sender, claimAssets);
        IERC20(shareToken).approve(vault, request.requestShares);
        IFundVault(vault).burnToken(address(this), request.requestShares);
        emit RedemptionClaim(
            msg.sender,
            epochId,
            claimAssets,
            request.requestShares
        );
    }

    function setStartTime(uint256 _startTime) external onlyInitialized onlyRole(MANAGER_ROLE) {
        startTime = _startTime;
        emit StartTimeSet(_startTime);
    }

     /**
     * @dev Pause 
     */
    function pause() external onlyInitialized onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Resume 
     */
    function unpause() external onlyInitialized onlyRole(PAUSER_ROLE)  {
        _unpause();
    }

    function _init(
        address _vault,
        address _vaultToken,
        address _rewardToken,
        address _manager,
        address _settleCaller,
        uint256 _minRedemptionAmount,
        uint256 _startTime
    ) internal {
        require(_vault != address(0), "FundYield: invalid vault");
        require(_vaultToken != address(0), "FundYield: invalid vault token");
        require(_manager != address(0), "FundYield: invalid manager");
        require(
            _settleCaller != address(0),
            "FundYield: invalid settle caller"
        );
        require(_rewardToken != address(0), "FundYield: invalid reward token");
        require(initialized == false, "FundYield: already initialized");

        __Ownable_init(_manager);
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        vault = _vault;
        shareToken = _vaultToken;
        rewardToken = _rewardToken;
        minRedemptionAmount = _minRedemptionAmount;
        startTime = _startTime;

        _grantRole(DEFAULT_ADMIN_ROLE, _manager);
        _grantRole(MANAGER_ROLE, _manager);
        _grantRole(PAUSER_ROLE, _manager);
        _grantRole(SETTLE_ROLE, _settleCaller);
        _setRoleAdmin(SETTLE_ROLE, MANAGER_ROLE);

        initialized = true;
        emit Initialized(
            _vault,
            _vaultToken,
            _rewardToken,
            _manager,
            _settleCaller,
            _minRedemptionAmount,
            _startTime
        );
    }

    function _verifySignature(
        uint256 epochId,
        uint256 assetAmount,
        bytes memory signature
    ) internal view {
        address validator = IVault(vault).getValidator();
        require(validator != address(0), "FundYield: validator not set");
        bytes32 payload = keccak256(
            abi.encodePacked(vault, epochId, assetAmount)
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(payload);
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == validator, "FundYield: invalid signature");
    }

    function pendingReward(address user,uint256 epochId) external view override returns (uint256) {
        RedemptionEpoch memory epoch = redemptionEpochs[epochId];
        if (epoch.epochStatus != EpochStatus.Liquidate){
            return 0;
        }
        RedemptionRequest memory request = redemptionEpochRequests[user][
            epochId
        ];
        if (request.requestShares==request.claimShares){
            return 0;
        }
        return (request.requestShares *
            epoch.totalRedemptionAssets) / epoch.totalShares;
    }


    function getEpochData(
        uint256 epoch
    ) public view returns (RedemptionEpoch memory) {
        return redemptionEpochs[epoch];
    }

    function getRedemptionRequest(
        uint256 epoch
    ) public view returns (RedemptionRequest memory) {
        return redemptionEpochRequests[msg.sender][epoch];
    }


}
