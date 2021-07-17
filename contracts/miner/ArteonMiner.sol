pragma solidity ^0.8.0;
// SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './../gpu/ArteonGPU.sol';
import './../token/Arteon.sol';

contract ArteonMiner is Context, ERC165, ERC721Holder, Ownable {
  using SafeMath for uint256;
  using Address for address;
  using Strings for uint256;

  uint256 private _totalSupply;
  uint256 private _minerCount;

  mapping (address => uint256) private _balances;
  mapping (uint256 => address) private _owners;

  Arteon public ARTEON_TOKEN;
  ArteonGPU public ARTEON_GPU;

  uint256 private _blockTime;
  uint256 private _maxReward;
  uint256 private _lastReward;
  uint256 private _halvings;
  uint256 private _nextHalving;
  mapping(address => uint256) private _rewards;
  mapping(address => uint256) private _startTime;

  event Activate(address indexed account, uint256 tokenId);
  event Deactivate(address indexed account, uint256 tokenId);
  event Reward(address account, uint256 reward);

  function initialize(address token, address gpu, uint256 blockTime, uint256 maxReward, uint256 halvings) public {
    ARTEON_TOKEN = Arteon(token);
    ARTEON_GPU = ArteonGPU(gpu);
    _blockTime = blockTime;
    _maxReward = maxReward;
    _halvings = halvings;
    uint256 blockHeight = block.number;
    _nextHalving = blockHeight.add(halvings);
  }

  function _rewardPerGPU() internal view returns (uint256) {
    if (_totalSupply == 0) {
      return 0;
    }
    return _maxReward / _totalSupply;
  }

  function getHalvings() public view returns (uint256) {
    return _halvings;
  }

  function getNextHalving() public view returns (uint256) {
    return _nextHalving;
  }

  function rewards(address account) public view returns (uint256) {
    return _rewards[account];
  }

  function rewardPerGPU() public view returns (uint256) {
    return _lastReward;
  }

  function getMaxReward() public view returns (uint256) {
    return _maxReward;
  }

  function earned() public returns (uint256) {
    return _calculateReward();
  }

  function activateGPU(uint256 tokenId) public {
    address account = msg.sender;
    if (_balances[account] > 0) {
      getReward();
    }
    ARTEON_GPU.safeTransferFrom(account, address(this), tokenId);
    _activateGPU(account, tokenId);
    emit Activate(account, tokenId);
  }

  function deactivateGPU(uint256 tokenId) public {
    getReward();
    address account = msg.sender;
    _deactivateGPU(account, tokenId);
    ARTEON_GPU.safeTransferFrom(address(this), account, tokenId);
    emit Deactivate(account, tokenId);
  }

  function getReward() public {
    address sender = msg.sender;
    uint256 reward = _calculateReward();
    if (reward > 0) {
      _rewards[sender] = 0;
      ARTEON_TOKEN.mint(sender, reward);
      _startTime[sender] = block.timestamp;
      emit Reward(sender, reward);
    }
  }

  function _calculateReward() internal returns (uint256) {
    address account = msg.sender;
    uint256 startTime = _startTime[account];
    if (block.timestamp > startTime + _blockTime) {
      uint256 remainder = block.timestamp - startTime;
      uint256 reward = _rewardPerGPU() * _balances[account];
      _rewards[account] = _rewards[account] + (reward * remainder);
      _startTime[account] = block.timestamp;
    }
    return _rewards[account];
  }

  function miners() public view virtual returns (uint256) {
    return _totalSupply;
  }

  function ownerOf(uint256 tokenId) public view virtual returns (address) {
    address owner = _owners[tokenId];
    require(owner != address(0), "ERC721: owner query for nonexistent token");
    return owner;
  }

  function totalSupply() public view returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual returns (uint256) {
    return _balances[account];
  }

  function _activateGPU(address account, uint256 tokenId) internal {
    require(!address(account).isContract(), "Required");
    require(tx.origin == account, "Required");
    require(tokenId > 0, "You need to activate at least one GPU");
    _totalSupply = _totalSupply.add(1);
    _balances[account] = _balances[account].add(1);
    _owners[tokenId] = account;
    _startTime[account] = block.timestamp;
    _checkHalving();
    _rewardPerGPU();
  }

  function _deactivateGPU(address account, uint256 tokenId) internal {
    require(tokenId > 0, "You need to deactivate at least one GPU");
    require(_owners[tokenId] == account, 'ArteonMiner: NOT_TOKEN_OWNER');
    _totalSupply = _totalSupply.sub(1);
    _balances[account] = _balances[account].sub(1);
    delete _owners[tokenId];
    if (balanceOf(account) == 0) {
      delete _startTime[account];
    } else {
      _startTime[account] = block.timestamp;
    }
    _checkHalving();
    _rewardPerGPU();
  }

  function _checkHalving() internal {
    uint256 blockHeight = block.number;
    if (blockHeight > _nextHalving) {
      _nextHalving = blockHeight.add(_halvings);
      _maxReward = _maxReward.div(2);
    }
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
