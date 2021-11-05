// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "contracts/token/interfaces/IArtOnline.sol";
import "contracts/storage/ArtOnlinePlatformStorage.sol";

contract ArtOnlinePlatform is Context, ERC165, IERC1155, IERC1155MetadataURI, Pausable, ArtOnlinePlatformStorage  {
  using Address for address;
  bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
  uint256 private immutable _CACHED_CHAIN_ID;

  bytes32 private immutable _HASHED_NAME;
  bytes32 private immutable _HASHED_VERSION;
  bytes32 private immutable _TYPE_HASH;

  modifier isWhiteListed(address account) {
    require(_blacklist[account] == 0, 'BLACKLISTED');
    _;
  }

  modifier onlyExchange() {
    require(_msgSender() == _artOnlineExchange, 'NO PERMISSION');
    _;
  }

  modifier lock() {
    require(unlocked == 1, 'LOCKED');
    unlocked = 0;
    _;
    unlocked = 1;
  }

  constructor(string memory uri_, string memory name, string memory version) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(MINT_ROLE, _msgSender());
    _setupRole(COMMUNITY_ROLE, _msgSender());
    _uri = uri_;

    bytes32 hashedName = keccak256(bytes(name));
    bytes32 hashedVersion = keccak256(bytes(version));
    bytes32 typeHash = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    _HASHED_NAME = hashedName;
    _HASHED_VERSION = hashedVersion;
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator(typeHash, hashedName, hashedVersion);
    _TYPE_HASH = typeHash;
  }

  function _domainSeparatorV4() internal view returns (bytes32) {
    if (block.chainid == _CACHED_CHAIN_ID) {
      return _CACHED_DOMAIN_SEPARATOR;
    } else {
      return _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME, _HASHED_VERSION);
    }
  }

  function _buildDomainSeparator(bytes32 typeHash, bytes32 nameHash, bytes32 versionHash) private view returns (bytes32) {
    return keccak256(abi.encode(typeHash, nameHash, versionHash, block.chainid, address(this)));
  }

  function _hashTypedDataV4(bytes32 structHash) internal view virtual returns (bytes32) {
    return ECDSA.toTypedDataHash(_domainSeparatorV4(), structHash);
  }

  function setArtOnline(address artonline_) external onlyRole(DEFAULT_ADMIN_ROLE) lock {
    _artOnline = artonline_;
  }

  function artOnline() external view virtual returns (address) {
    return _artOnline;
  }

  function setArtOnlineExchange(address artOnlineExchange_) external onlyRole(DEFAULT_ADMIN_ROLE) lock {
    _artOnlineExchange = artOnlineExchange_;
  }

  function artOnlineExchange() external view virtual returns (address) {
    return _artOnlineExchange;
  }

  function cap(uint256 id) external view virtual returns (uint256) {
    return _cap[id];
  }

  function mining(uint256 id, uint256 tokenId) external view virtual returns (uint256) {
    return _mining[id][tokenId];
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC165, IERC165) returns (bool) {
    return
      interfaceId == type(IERC1155).interfaceId ||
      interfaceId == type(IERC1155MetadataURI).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  function uri(uint256) public view virtual override returns (string memory) {
    return _uri;
  }

  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    require(account != address(0), "balance query for the zero address");
    return _balances[id][account];
  }

  function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
  public
  view
  virtual
  override
  returns (uint256[] memory) {
    require(accounts.length == ids.length, "accounts and ids length mismatch");

    uint256[] memory batchBalances = new uint256[](accounts.length);

    for (uint256 i = 0; i < accounts.length; ++i) {
        batchBalances[i] = balanceOf(accounts[i], ids[i]);
    }

    return batchBalances;
  }

  function setApprovalForAll(address operator, bool approved) public virtual override {
    require(_msgSender() != operator, "setting approval status for self");

    _operatorApprovals[_msgSender()][operator] = approved;
    emit ApprovalForAll(_msgSender(), operator, approved);
  }

  function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
    return _operatorApprovals[account][operator];
  }

  function safeTransferFrom(
      address from,
      address to,
      uint256 id,
      uint256 amount,
      bytes memory data
  ) external virtual override isWhiteListed(from) isWhiteListed(to) {
    require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        "caller is not owner nor approved"
    );
    _safeTransferFrom(from, to, id, amount, data);
  }

  function safeBatchTransferFrom(
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
  ) external virtual override isWhiteListed(from) isWhiteListed(to) {
    require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        "transfer caller is not owner nor approved"
    );
    _safeBatchTransferFrom(from, to, ids, amounts, data);
  }

  function _safeTransferFrom(
      address from,
      address to,
      uint256 id,
      uint256 amount,
      bytes memory data
  ) internal virtual {
    require(to != address(0), "transfer to the zero address");

    address operator = _msgSender();

    _beforeTokenTransfer(operator, from, to, _asSingletonArray(id), _asSingletonArray(amount), data);
    _removeBalance(from, id, amount, 0);
    _addBalance(to, id, amount, 0);

    emit TransferSingle(operator, from, to, id, amount);

    _doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
  }

  function _safeBatchTransferFrom(
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
  ) internal virtual {
    require(ids.length == amounts.length, "ids and amounts length mismatch");
    require(to != address(0), "transfer to the zero address");

    address operator = _msgSender();

    _beforeTokenTransfer(operator, from, to, ids, amounts, data);

    for (uint256 i = 0; i < ids.length; ++i) {
      _removeBalance(from, ids[i], amounts[i], 0);
      _addBalance(to, ids[i], amounts[i], 0);
    }

    emit TransferBatch(operator, from, to, ids, amounts);

    _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
  }

  function totalSupply(uint256 id) public view returns (uint256) {
    return _totalSupply[id];
  }

  function addToken(string memory name, uint256 cap_) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
    uint256 id = _tokens.length;
    require(bytes(tokenNames[id]).length == 0, 'token exists');
    _tokens.push(name);
    _cap[id] = cap_;
    tokenNames[id] = name;
    emit AddToken(name, id);
  }

  function addItem(uint256 id, uint256 bonus, uint256 halving) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _items.push(id);
    _maxReward[id] = bonus; // percentage
    _halvings[id] = halving;
    unchecked {
      _nextHalving[id] = block.number + halving;
    }
    emit AddItem(_tokens[id], id, bonus);
  }

  function addPool(uint256 id, uint256 maxReward, uint256 halving) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _pools.push(id);
    _maxReward[id] = maxReward;
    _halvings[id] = halving;
    unchecked {
      _nextHalving[id] = block.number + halving;
    }
    emit AddPool(_tokens[id], id, maxReward);
  }

  function mint(address to, uint256 id, uint256 amount) public whenNotPaused virtual onlyRole(MINT_ROLE) {
    _mint(to, id, amount, "");
  }

  function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts) public whenNotPaused virtual onlyRole(MINT_ROLE) {
    _mintBatch(to, ids, amounts, "");
  }

  function burn(address from, uint256 id, uint256 amount) public virtual whenNotPaused onlyRole(MINT_ROLE) {
    _burn(from, id, amount, "");
  }

  function burnBatch(address from, uint256[] memory ids, uint256[] memory amounts) public whenNotPaused virtual onlyRole(MINT_ROLE) {
    _burnBatch(from, ids, amounts, "");
  }

  function _beforeMint(address to, uint256 id, uint256 amount) internal virtual {
    require(_cap[id] >= amount, 'exceeds token cap');
    require(_owners[id][amount] == address(0), 'already exists');
    require(to != address(0), "mint to the zero address");
  }

  function _mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal virtual {
    require(ids.length == amounts.length, "ids and amounts length mismatch");
    address operator = _msgSender();

    _beforeTokenTransfer(operator, address(0), to, ids, amounts, data);

    for (uint256 i = 0; i < ids.length; i++) {
      _beforeMint(to, ids[i], amounts[i]);
      _addBalance(to, ids[i], amounts[i], 1);
    }

    emit TransferBatch(operator, address(0), to, ids, amounts);
    _doSafeBatchTransferAcceptanceCheck(operator, address(0), to, ids, amounts, data);
  }

  function _mint(address to, uint256 id, uint256 amount, bytes memory data) internal virtual {
    _beforeMint(to, id, amount);
    address operator = _msgSender();

    _beforeTokenTransfer(operator, address(0), to, _asSingletonArray(id), _asSingletonArray(amount), data);

    _addBalance(to, id, amount, 1);
    emit TransferSingle(operator, address(0), to, id, amount);

    _doSafeTransferAcceptanceCheck(operator, address(0), to, id, amount, data);
  }

  function _addBalance(address to, uint256 id, uint256 amount, uint256 mints) internal {
    _balances[id][to] += 1;
    if (mints == 1) {
      _totalSupply[id] += 1;
    }
    _owners[id][amount] = to;
  }

  function _removeBalance(address from, uint256 id, uint256 amount, uint256 burns) internal {
    require(_owners[id][amount] == from, "not an owner");

    if (burns == 1) {
      unchecked {
        _totalSupply[id] -= 1;
      }
    }
    unchecked {
      _balances[id][from] -= 1;
    }
    _owners[id][amount] = address(0);
  }

  function _beforeTokenTransfer(
      address operator,
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
    ) internal virtual {
      for (uint256 i = 0; i < ids.length; i++) {
        if (from != address(0)) {
          uint256 id = ids[i];
          uint256 amount = amounts[i];
          require(_mining[id][amount] == 0, "DEACTIVATE_FIRST");
          require(_owners[id][amount] == from, 'not an owner');
        }
      }
    }

    function _burn(address from, uint256 id, uint256 amount, bytes memory data) internal virtual {
      require(from != address(0), "burn from the zero address");

      address operator = _msgSender();

      _beforeTokenTransfer(operator, from, address(0), _asSingletonArray(id), _asSingletonArray(amount), "");
      _removeBalance(from, id, amount, 1);

      emit TransferSingle(operator, from, address(0), id, amount);
    }
    function _burnBatch(address from, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal virtual {
      require(from != address(0), "burn from the zero address");
      require(ids.length == amounts.length, "ids and amounts length mismatch");

      address operator = _msgSender();

      _beforeTokenTransfer(operator, from, address(0), ids, amounts, "");

      for (uint256 i = 0; i < ids.length; i++) {
        _removeBalance(from, ids[i], amounts[i], 1);
      }
      emit TransferBatch(operator, from, address(0), ids, amounts);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private {
      if (to.isContract()) {
        try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
            if (response != IERC1155Receiver.onERC1155Received.selector) {
                revert("ERC1155Receiver rejected tokens");
            }
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
            revert("transfer to non ERC1155Receiver implementer");
        }
      }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
      if (to.isContract()) {
        try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (
            bytes4 response
        ) {
            if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                revert("ERC1155Receiver rejected tokens");
            }
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
            revert("transfer to non ERC1155Receiver implementer");
        }
      }
    }

    function _asSingletonArray(uint256 element) private pure returns (uint256[] memory) {
      uint256[] memory array = new uint256[](1);
      array[0] = element;

      return array;
    }

    function _rewardPerGPU(uint256 id) internal view returns (uint256) {
      if (_totalMiners[id] == 0) {
        return 0;
      }
      return _maxReward[id] / _totalMiners[id];
    }

    function setActivationPrice(uint256 id, uint256 price) external onlyRole(DEFAULT_ADMIN_ROLE) {
      _activationPrice[id] = price;
    }

    function activationPrice(uint256 id) public view returns (uint256) {
      return _activationPrice[id];
    }

    function getHalvings(uint256 id) public view returns (uint256) {
      return _halvings[id];
    }

    function getNextHalving(uint256 id) public view returns (uint256) {
      return _nextHalving[id];
    }

    function rewards(address account, uint256 id) public view returns (uint256) {
      return _rewards[id][account];
    }

    function rewardPerGPU(uint256 id) public view returns (uint256) {
      return _rewardPerGPU(id);
    }

    function getMaxReward(uint256 id) public view returns (uint256) {
      return _maxReward[id];
    }

    function earned(address account, uint256 id) public returns (uint256) {
      return _calculateReward(account, id);
    }

    function miners(uint256 id) public view virtual returns (uint256) {
      return _totalMiners[id];
    }

    function activateGPUBatch(uint256[] memory ids, uint256[] memory amounts) external {
      for (uint256 i = 0; i < ids.length; i++) {
        activateGPU(ids[i], amounts[i]);
      }
    }

    function deactivateGPUBatch(uint256[] memory ids, uint256[] memory amounts) external {
      for (uint256 i = 0; i < ids.length; i++) {
        deactivateGPU(ids[i], amounts[i]);
      }
    }

    function activateGPU(uint256 id, uint256 tokenId) public whenNotPaused isWhiteListed(msg.sender) {
      address account = msg.sender;
      _beforeAction(account, id, tokenId);
      if (_miners[id][account] > 0) {
        getReward(id);
      }
      _activateGPU(account, id, tokenId);
      emit Activate(account, id, tokenId);
    }

    function deactivateGPU(uint256 id, uint256 tokenId) public whenNotPaused isWhiteListed(msg.sender) {
      address account = msg.sender;
      _beforeAction(account, id, tokenId);
      getReward(id);
      _deactivateGPU(account, id, tokenId);
      emit Deactivate(account, id, tokenId);
    }

    function activateItem(uint256 id, uint256 itemId, uint256 tokenId) public whenNotPaused isWhiteListed(msg.sender) {
      address account = msg.sender;
      _beforeAction(account, itemId, tokenId);
      uint256 price = activationPrice(itemId);
      IArtOnline(_artOnline).burn(account, price);
      if (_miners[id][account] > 0) {
        getReward(id);
      }
      _activateItem(account, id, itemId, tokenId);
      emit ActivateItem(account, id, itemId, tokenId);
    }

    function deactivateItem(uint256 id, uint256 itemId, uint256 tokenId) public whenNotPaused isWhiteListed(msg.sender) {
      address account = msg.sender;
      _beforeAction(account, itemId, tokenId);
      if (_miners[id][account] > 0) {
        getReward(id);
      }
      _deactivateItem(account, id, itemId, tokenId);
      emit DeactivateItem(account, id, itemId, tokenId);
    }

    function getReward(uint256 id) public whenNotPaused isWhiteListed(msg.sender) {
      address sender = msg.sender;
      uint256 reward = _calculateReward(sender, id);
      if (reward > 0) {
        IArtOnline(_artOnline).mint(sender, reward);
        _rewards[id][sender] = 0;
        _startTime[id][sender] = block.timestamp;
        emit Reward(sender, id, reward);
      }
    }

    function getRewardBatch(uint256[] memory ids) public whenNotPaused isWhiteListed(msg.sender) {
      address sender = msg.sender;
      for (uint256 i = 0; i < ids.length; i++) {
        uint256 id = ids[i];
        uint256 reward = _calculateReward(sender, id);
        if (reward > 0) {
          IArtOnline(_artOnline).mint(sender, reward);
          _rewards[id][sender] = 0;
          _startTime[id][sender] = block.timestamp;
          emit Reward(sender, id, reward);
        }
      }


    }

    function itemBonus(uint256 id) external view returns (uint256) {
      return _maxReward[id];
    }

    function _itemBonuses(address sender, uint256 id) internal view returns (uint256) {
      uint256 percentage;

      for (uint256 i = 0; i < _items.length; i++) {
        uint256 itemId = _items[i];
        if (_bonuses[id][sender][itemId] > 0) {
          percentage = percentage + (_maxReward[itemId] * _bonuses[id][sender][itemId]);
        }

      }
      return percentage;
    }

    function _calculateReward(address sender, uint256 id) internal returns (uint256) {
      uint256 startTime = _startTime[id][sender];
      if (block.timestamp > startTime + _blockTime) {
        unchecked {
          uint256 remainder = block.timestamp - startTime;
          uint256 reward = _rewardPerGPU(id) * _miners[id][sender];
          reward = reward * remainder;
          _rewards[id][sender] = _rewards[id][sender] + (reward + ((reward / 100) * _itemBonuses(sender, id)));
        }
        _startTime[id][sender] = block.timestamp;
      }
      return _rewards[id][sender];
    }

    function _beforeAction(address account, uint256 id, uint256 tokenId) internal view {
      require(tokenId > 0, "NO_ZERO");
      require(ownerOf(id, tokenId) == account, 'NOT_OWNER');
    }

    function _activateItem(address account, uint256 id, uint256 itemId, uint256 tokenId) internal {
      require(_activated[itemId][tokenId] == 0, 'DEACTIVATE_FIRST');
      unchecked {
        _bonuses[id][account][itemId] += 1;
        _activated[itemId][tokenId] = 1;
      }
      _checkHalving(id);
      _rewardPerGPU(id);
    }

    function _deactivateItem(address account, uint256 id, uint256 itemId, uint256 tokenId) internal {
      require(_activated[itemId][tokenId] == 0, 'NOT_ACTIVATED');
      unchecked {
        _bonuses[id][account][itemId] -= 1;
        _activated[itemId][tokenId] = 0;
      }
      _checkHalving(id);
      _rewardPerGPU(id);
    }

    function _activateGPU(address account, uint256 id, uint256 tokenId) internal {
      unchecked {
        _startTime[id][account] = block.timestamp;
        _miners[id][account] += 1;
      }
      _mining[id][tokenId] = 1;
      _totalMiners[id] += 1;
      _checkHalving(id);
      _rewardPerGPU(id);
    }

    function _deactivateGPU(address account, uint256 id, uint256 tokenId) internal {
      unchecked {
        _miners[id][account] -= 1;
        _totalMiners[id] -= 1;
        _mining[id][tokenId] = 0;
      }
      if (_miners[id][account] == 0) {
        delete _startTime[id][account];
      } else {
        _startTime[id][account] = block.timestamp;
      }
      for (uint256 i = 0; i < _items.length; i++) {
        uint256 itemId = _items[i];
        require(_bonuses[id][account][itemId] == 0, 'Deactivate upgrades first');
      }
      _checkHalving(id);
      _rewardPerGPU(id);
    }

    function _checkHalving(uint256 id) internal {
      uint256 blockHeight = block.number;
      if (blockHeight > _nextHalving[id]) {
        unchecked {
          _nextHalving[id] += _halvings[id];
          _maxReward[id] = _maxReward[id] / 2;
        }
      }
    }

    function ownerOf(uint256 id, uint256 tokenId) public view virtual returns (address) {
      address owner = _owners[id][tokenId];
      require(owner != address(0), "NONEXISTENT_TOKEN");
      return owner;
    }

    function ownerOfBatch(uint256[] memory ids, uint256[] memory tokenIds) public view virtual returns (address[] memory) {
      require(ids.length == tokenIds.length, "ids and tokenIds length mismatch");

      address[] memory batchOwners = new address[](ids.length);

      for (uint256 i = 0; i < ids.length; ++i) {
        batchOwners[i] = ownerOf(ids[i], tokenIds[i]);
      }

      return batchOwners;
    }

    function poolsLength() external view returns (uint256) {
      return _pools.length;
    }

    function itemsLength() external view returns (uint256) {
      return _items.length;
    }

    function tokensLength() external view returns (uint256) {
      return _tokens.length;
    }

    function tokens() external view returns (string[] memory) {
      return _tokens;
    }

    function pools() external view returns (uint256[] memory) {
      return _pools;
    }

    function items() external view returns (uint256[] memory) {
      return _items;
    }

    function token(uint256 id) external view returns (string memory) {
      return _tokens[id];
    }

    function pool(uint256 id) external view returns (uint256) {
      return _pools[id];
    }

    function item(uint256 id) external view returns (uint256) {
      return _items[id];
    }

    function activated(uint256 id, uint256 tokenId) external view returns (uint256) {
      return _activated[id][tokenId];
    }

    function mintAsset(address to, uint256 id) external onlyExchange() returns (uint256) {
      uint256 tokenId = _totalSupply[id] + 1;
      _mint(to, id, tokenId, "");
      return tokenId;
    }

    function mintAssets(address to, uint256 id, uint256 amount) external onlyExchange() returns (uint256[] memory) {
      return __mintAssets(to, id, amount);
    }

    function _mintAssets(address to, uint256 id, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256[] memory) {
      return __mintAssets(to, id, amount);
    }

    function __mintAssets(address to, uint256 id, uint256 amount) internal returns (uint256[] memory) {
      uint256[] memory tokenIds = new uint256[](amount);
      for (uint256 i = 0; i < amount; i++) {
        uint256 tokenId = _totalSupply[id] + 1;
        _mint(to, id, tokenId, "");
        tokenIds[i] = tokenId;
      }
      return tokenIds;
    }

    function pause() external virtual whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
      super._pause();
    }

    function unpause() external virtual whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
      super._unpause();
    }

    function blacklist(address account) external onlyRole(COMMUNITY_ROLE) isWhiteListed(account) {
      _blacklist[account] = 1;
    }
}
