// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import './interfaces/IArtOnlineListingERC1155.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import './interfaces/IArtOnlineExchangeFactory.sol';
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import './ArtOnlineListing.sol';

contract ArtOnlineListingERC1155 is ArtOnlineListing, IERC1155Receiver, IArtOnlineListingERC1155 {
  uint256 internal _id;

  constructor() {
    _factory = msg.sender;
  }

  function buy(address receiver) external override(IArtOnlineListing, ArtOnlineListing) payable {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    require(msg.sender != _owner, 'SELLER_OWN');
    // address currencyIn = _currency;
    uint256 fee = IArtOnlineExchangeFactory(_factory).feeFor(_price);
    address feeReceiver = IArtOnlineExchangeFactory(_factory).feeReceiver();
    if (msg.value != 0) {
      _buyWithNative(fee, payable(feeReceiver));
    } else {
      uint256 balance = IERC20(_currency).balanceOf(receiver);
      require(balance >= _price, 'NOT_ENOUGH_TOKENS');
      _buyWithCurrency(receiver, fee, feeReceiver);
    }
    IERC1155(_contractAddress).safeTransferFrom(address(this), receiver, _id, _tokenId, '');
    address oldOwner = _owner;
    _owner = receiver;
    _listed = 0;
    emit OwnerChange(oldOwner, _owner);
    emit Listed(_listed);
  }

  function initialize(address owner_, address contractAddress_, uint256 id_, uint256 tokenId_, uint256 price_, address currency_) external {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    _contractAddress = contractAddress_;
    _tokenId = tokenId_;
    _price = price_;
    _currency = currency_;
    _owner = owner_;
    _listed = 1;
    _id = id_;
    emit OwnerChange(address(0), _owner);
    emit Listed(_listed);
  }

  function id() external view override returns (uint256) {
    return _id;
  }

  function onERC1155Received(
      address operator,
      address from,
      uint256 id_,
      uint256 value,
      bytes calldata data
  ) external pure override returns (bytes4) {
    return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
  }

  function onERC1155BatchReceived(
      address operator,
      address from,
      uint256[] calldata ids,
      uint256[] calldata values,
      bytes calldata data
  ) external pure override returns (bytes4) {
    return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
  }

   function supportsInterface(bytes4 interfaceId) external pure override(IArtOnlineListingERC1155, IERC165) returns (bool) {
     return
       interfaceId == type(IERC1155).interfaceId;
   }
}
