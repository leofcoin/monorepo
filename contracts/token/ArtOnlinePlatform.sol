// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./../storage/ArtOnlinePlatformStorage.sol";
import './utils/EIP712.sol';
import './../access/SetArtOnlinePlatform.sol';

contract ArtOnlinePlatform is Context, ERC165, IERC1155, IERC1155MetadataURI, Pausable, EIP712, SetArtOnlinePlatform, ArtOnlinePlatformStorage {
  using Address for address;

  modifier lock() {
    require(unlocked == 1, 'LOCKED');
    unlocked = 0;
    _;
    unlocked = 1;
  }

  constructor(string memory uri_, string memory name, string memory version, address bridger, address access)
    EIP712(name, version)
    SetArtOnlinePlatform(bridger, access)
  {
    _uri = uri_;
  }

  function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
    if (_i == 0) {
      return "0";
    }
    uint j = _i;
    uint len;
    while (j != 0) {
      len++;
      j /= 10;
    }
    bytes memory bstr = new bytes(len);
    uint k = len;
    while (_i != 0) {
      k = k-1;
      uint8 temp = (48 + uint8(_i - _i / 10 * 10));
      bytes1 b1 = bytes1(temp);
      bstr[k] = b1;
      _i /= 10;
    }
    return string(bstr);
  }

  function cap(uint256 id) external view virtual returns (uint256) {
    return _cap[id];
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return
      interfaceId == type(IERC1155).interfaceId ||
      interfaceId == type(IERC1155MetadataURI).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    return string(abi.encodePacked(_uri, uint2str(_tokenId), ".json"));
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

  function addToken(string memory name, uint256 cap_) public virtual onlyAdmin() {
    uint256 id = _tokens.length;
    require(bytes(tokenNames[id]).length == 0, 'token exists');
    _tokens.push(name);
    _cap[id] = cap_;
    tokenNames[id] = name;
    emit AddToken(name, id);
  }

  function mint(address to, uint256 id, uint256 amount) public whenNotPaused virtual onlyMinter() {
    _mint(to, id, amount, "");
  }

  function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts) public whenNotPaused virtual onlyMinter() {
    _mintBatch(to, ids, amounts, "");
  }

  function burn(address from, uint256 id, uint256 amount) public virtual whenNotPaused onlyMinter() {
    _burn(from, id, amount, "");
  }

  function burnBatch(address from, uint256[] memory ids, uint256[] memory amounts) public whenNotPaused virtual onlyMinter() {
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
    require(_owners[id][amount] == from || isApprovedForAll(_owners[id][amount], _msgSender()), "not an owner or approved");

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
          require(_artOnlineMiningInterface.mining(id, amount) == 0, "DEACTIVATE_FIRST");
          require(_owners[id][amount] == from || isApprovedForAll(_owners[id][amount], _msgSender()), "not an owner or approved");
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

    function activateGPUBatch(uint256[] memory ids, uint256[] memory tokenIds) external {
      _artOnlineMiningInterface.activateGPUBatch(msg.sender, ids, tokenIds);
    }

    function deactivateGPUBatch(uint256[] memory ids, uint256[] memory tokenIds) external {
      _artOnlineMiningInterface.deactivateGPUBatch(msg.sender, ids, tokenIds);
    }

    function activateGPU(uint256 id, uint256 tokenId) public {
      _artOnlineMiningInterface.activateGPU(msg.sender, id, tokenId);
    }

    function deactivateGPU(uint256 id, uint256 tokenId) public {
      _artOnlineMiningInterface.deactivateGPU(msg.sender, id, tokenId);
    }

    function activateItem(uint256 id, uint256 itemId, uint256 tokenId) public {
      _artOnlineMiningInterface.activateItem(msg.sender, id, itemId, tokenId);
    }

    function deactivateItem(uint256 id, uint256 itemId, uint256 tokenId) public {
      _artOnlineMiningInterface.deactivateItem(msg.sender, id, itemId, tokenId);
    }

    function stakeReward(uint256 id) public {
      _artOnlineMiningInterface.stakeReward(msg.sender, id);
    }

    function getReward(uint256 id) public {
      _artOnlineMiningInterface.getReward(msg.sender, id);
    }

    function stakeRewardBatch(uint256[] memory ids) public {
      _artOnlineMiningInterface.getRewardBatch(msg.sender, ids);
    }

    function getRewardBatch(uint256[] memory ids) public {
      _artOnlineMiningInterface.getRewardBatch(msg.sender, ids);
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

    function tokensLength() external view virtual returns (uint256) {
      return _tokens.length;
    }

    function tokens() external view virtual returns (string[] memory) {
      return _tokens;
    }

    function token(uint256 id) external view virtual returns (string memory) {
      return _tokens[id];
    }

    function mintAsset(address to, uint256 id) external onlyExchange() returns (uint256) {
      uint256 tokenId = _totalSupply[id] + 1;
      _mint(to, id, tokenId, "");
      return tokenId;
    }

    function mintAssets(address to, uint256 id, uint256 amount) external onlyExchange() returns (uint256[] memory) {
      return __mintAssets(to, id, amount);
    }

    function _mintAssets(address to, uint256 id, uint256 amount) external onlyAdmin() returns (uint256[] memory) {
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
}
