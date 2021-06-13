pragma solidity ^0.8.0;

import './../../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol';
import './../../node_modules/@openzeppelin/contracts/utils/Strings.sol';
import './../../node_modules/@openzeppelin/contracts/utils/Address.sol';
import './../../node_modules/@openzeppelin/contracts/utils/math/Math.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './../../node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import './../../node_modules/@openzeppelin/contracts/access/Ownable.sol';
import './../../node_modules/@openzeppelin/contracts/utils/Context.sol';
import './../gpu/ArteonGPU.sol';
import './../token/Arteon.sol';

contract ArteonMiner is Context, ERC165, ERC721Holder, Ownable {
  using SafeMath for uint256;
  using Address for address;
  using Strings for uint256;

  Arteon public ARTEON_TOKEN;
  ArteonGPU public ARTEON_GPU;

  uint256 public constant DURATION = 2 days;
  uint256 public initreward = 2500 * 1e18;
  uint256 public starttime = 1621693530;
  uint256 public periodFinish = 0;
  uint256 public rewardRate = 0;
  uint256 public lastUpdateTime;
  uint256 public rewardPerTokenStored;
  uint256 private _totalSupply;

  mapping(address => uint256) public userRewardPerTokenPaid;
  mapping(address => uint256) public rewards;
  mapping (address => uint256) private _balances;
  mapping (uint256 => address) private _tokenApprovals;
  mapping (uint256 => address) private _owners;
  mapping (address => mapping (address => bool)) private _operatorApprovals;
  uint256 private _minerCount;

  event RewardAdded(uint256 reward);
  event ActiveCards(address indexed user, uint256 amount);
  event Deactivated(address indexed user, uint256 amount);
  event RewardPaid(address indexed user, uint256 reward);

  constructor(address token, address gpu) {
    ARTEON_TOKEN = Arteon(token);
    ARTEON_GPU = ArteonGPU(gpu);
  }

  function miners() public view virtual returns (uint256) {
    return _minerCount;
  }

  function ownerOf(uint256 tokenId) public view virtual returns (address) {
    address owner = _owners[tokenId];
    require(owner != address(0), "ERC721: owner query for nonexistent token");
    return owner;
  }

  modifier updateReward(address account) {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = lastTimeRewardApplicable();
    if (account != address(0)) {
        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
    _;
  }

  function lastTimeRewardApplicable() public view returns (uint256) {
      return Math.min(block.timestamp, periodFinish);
  }

  function rewardPerToken() public view returns (uint256) {
    if (totalSupply() == 0) {
      return rewardPerTokenStored;
    }
      return
      rewardPerTokenStored.add(
          lastTimeRewardApplicable()
              .sub(lastUpdateTime)
              .mul(rewardRate)
              .mul(1e18)
              .div(totalSupply())
      );
    }

    function earned(address account) public view returns (uint256) {
      return
        balanceOf(account)
          .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
          .div(1e18)
          .add(rewards[account]);
    }


  function totalSupply() public view returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual returns (uint256) {
    return _balances[account];
  }

  function _mine(uint256 tokenId) internal {
    address sender = msg.sender;
    require(!address(sender).isContract(), "Required");
    require(tx.origin == sender, "Required");
    _totalSupply = _totalSupply.add(1);
    _balances[sender] = _balances[sender].add(1);
    _owners[tokenId] = sender;
    _minerCount++;
    ARTEON_GPU.safeTransferFrom(sender, address(this), tokenId);
  }

  function _deactivate_gpu(uint256 tokenId) internal {
    _totalSupply = _totalSupply.sub(1);
    _balances[msg.sender] = _balances[msg.sender].sub(1);
    delete _owners[tokenId];
    _minerCount--;
    ARTEON_GPU.safeTransferFrom(address(this), msg.sender, tokenId);
  }

  // Mine visibility is public as overriding ArteonGPU's mine() function
  function mine(uint256 tokenId) public updateReward(msg.sender) checkhalve checkStart {
    require(tokenId >= 0, "You need to active at least one Arteon GPU");
    _mine(tokenId);
    emit ActiveCards(msg.sender, tokenId);
  }

  function deactivate_gpu(uint256 tokenId) public updateReward(msg.sender) {
    require(tokenId >= 0, "You need to deactivate at least one GPU");
    _deactivate_gpu(tokenId);
    emit Deactivated(msg.sender, tokenId);
  }

  function getReward() public updateReward(msg.sender) checkhalve {
    uint256 reward = earned(msg.sender);
    if (reward > 0) {
      rewards[msg.sender] = 0;
      SafeERC20.safeTransferFrom(ARTEON_TOKEN, address(this), msg.sender, reward);
      emit RewardPaid(msg.sender, reward);
    }
  }

  modifier checkhalve(){
    if (block.timestamp >= periodFinish) {
      initreward = initreward.mul(50).div(100);
      ARTEON_TOKEN.mint(address(this), initreward);
      rewardRate = initreward.div(DURATION);
      periodFinish = block.timestamp.add(DURATION);
      emit RewardAdded(initreward);
    }
    _;
  }
  modifier checkStart(){
    require(block.timestamp > starttime,"not start");
    _;
  }

  function notifyRewardAmount(uint256 reward) external onlyOwner updateReward(address(0)) {
    if (block.timestamp >= periodFinish) {
      rewardRate = reward.div(DURATION);
    } else {
      uint256 remaining = periodFinish.sub(block.timestamp);
      uint256 leftover = remaining.mul(rewardRate);
      rewardRate = reward.add(leftover).div(DURATION);
    }

    lastUpdateTime = block.timestamp;
    periodFinish = block.timestamp.add(DURATION);
    emit RewardAdded(reward);
  }

  function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory _data) private returns (bool) {
    if (to.isContract()) {
      try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
        return retval == IERC721Receiver(to).onERC721Received.selector;
      } catch (bytes memory reason) {
        if (reason.length == 0) {
          revert("ERC721: transfer to non ERC721Receiver implementer");
        } else {
        // solhint-disable-next-line no-inline-assembly
          assembly {
            revert(add(32, reason), mload(reason))
          }
        }
      }
    } else {
     return true;
    }
  }
}
