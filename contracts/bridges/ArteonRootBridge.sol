import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import 'contracts/tunnel/FxBaseRootTunnel.sol';
import 'contracts/token/interfaces/IArteonL1L2.sol';

contract ArteonRootBridge is Context, ERC1155Holder, AccessControl, Pausable, FxBaseRootTunnel {
  bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
  bytes32 public constant DEPOSIT_BATCH = keccak256("DEPOSIT_BATCH");
  bytes32 public constant WITHDRAW = keccak256("WITHDRAW");
  bytes32 public constant WITHDRAW_BATCH = keccak256("WITHDRAW_BATCH");

  address internal _rootToken;
  address internal _childToken;

  event TokenMapped(address indexed rootToken, address indexed childToken);
  event Withdraw(address indexed rootToken, address indexed childToken, address indexed userAddress, uint256 id, uint256 amount);
  event Deposit(address indexed rootToken, address indexed depositor, address indexed userAddress, uint256 id, uint256 amount);
  event WithdrawBatch(address indexed rootToken, address indexed childToken, address indexed userAddress, uint256[] ids, uint256[] amounts);
  event DepositBatch(address indexed rootToken, address indexed userAddress, uint256[] ids, uint256[] amounts);

  constructor(address _checkpointManager, address _fxRoot) FxBaseRootTunnel(_checkpointManager, _fxRoot) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }
  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC1155Receiver) returns (bool) {
    return interfaceId == type(IArteonL1L2).interfaceId || super.supportsInterface(interfaceId);
  }
  // token/proxy
  function mapToken(address rootToken_, address childToken_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _rootToken = rootToken_;
    _childToken = childToken_;
    emit TokenMapped(_rootToken, _childToken);
  }

  function deposit(address user, uint256 id, uint256 amount, bytes memory data) public {
    // transfer from depositor to this contract
    IArteonL1L2(_rootToken).safeTransferFrom(
      msg.sender,    // depositor
      address(this), // manager contract
      id,
      amount,
      data
    );

    // DEPOSIT, encode(_rootToken, depositor, user, id, amount, extra data)
    bytes memory message = abi.encode(DEPOSIT, abi.encode(_rootToken, msg.sender, user, id, amount, data));
    _sendMessageToChild(message);
    emit Deposit(_rootToken, msg.sender, user, id, amount);
  }


  function depositBatch(address user, uint256[] memory ids, uint256[] memory amounts, bytes memory data) public {
    // transfer from depositor to this contract
    IArteonL1L2(_rootToken).safeBatchTransferFrom(
      msg.sender,    // depositor
      address(this), // manager contract
      ids,
      amounts,
      data
    );

    // DEPOSIT_BATCH, encode(rootToken, depositor, user, id, amount, extra data)
    bytes memory message = abi.encode(DEPOSIT_BATCH, abi.encode(_rootToken, msg.sender, user, ids, amounts, data));
    _sendMessageToChild(message);
    emit DepositBatch(_rootToken, user, ids, amounts);
  }

  function _processMessageFromChild(bytes memory data) internal override {
    (bytes32 syncType, bytes memory syncData) = abi.decode(data, (bytes32, bytes));

    if(syncType == WITHDRAW) {
      _syncWithdraw(syncData);
    } else if (syncType == WITHDRAW_BATCH) {
      _syncBatchWithdraw(syncData);
    } else {
      revert("INVALID_SYNC_TYPE");
    }
  }

  function _syncWithdraw(bytes memory syncData) internal {
    (address rootToken, address childToken, address user, uint256 id, uint256 amount, bytes memory data) = abi.decode(syncData, (address, address, address, uint256, uint256, bytes));
    require(_childToken == childToken, "INVALID_MAPPING_ON_EXIT");
    IArteonL1L2(rootToken).safeTransferFrom(address(this), user, id, amount, data);
    emit Withdraw(rootToken, childToken, user, id, amount);
  }

  function _syncBatchWithdraw(bytes memory syncData) internal {
    (address rootToken, address childToken, address user, uint256[] memory ids, uint256[] memory amounts, bytes memory data) = abi.decode(syncData, (address, address, address, uint256[], uint256[], bytes));
    require(_childToken == childToken, "INVALID_MAPPING_ON_EXIT");
    IArteonL1L2(rootToken).safeBatchTransferFrom(address(this), user, ids, amounts, data);
    emit WithdrawBatch(rootToken, childToken, user, ids, amounts);
  }

   function pause() external virtual whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
     super._pause();
   }

   function unpause() external virtual whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
     super._unpause();
   }
}
