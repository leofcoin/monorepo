// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IWETH.sol';

contract ArteonExchangeV1P1 is Ownable, Pausable {
  IWETH constant internal weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
  IUniswapV2Factory constant internal uniswapV2 = IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
  using UniswapV2ExchangeLib for IUniswapV2Exchange;
  using SafeERC20 for IERC20;
  address public ARTEON_TOKEN;
  bool private locked;

  struct Listing {
    address owner;
    address gpu;
    uint256 tokenId;
    uint256 price;
    uint256 index;
    bool listed;
  }

  mapping (address => mapping(uint256 => address)) public getListing;
  mapping (address => address[]) public gpuListing;
  mapping (address => Listing) public lists;

  event ListingCreated(address ArteonGPU, uint256 tokenId, address listing, uint, uint256 price);
  event Delist(address gpu, uint256 tokenId);
  event Buy(address gpu, uint256 tokenId, address listing, address owner, uint256 price);

  constructor(address token) {
    ARTEON_TOKEN = token;
  }

  modifier isListed(address gpu, uint256 tokenId) {
    address listing = getListing[gpu][tokenId];
    require(listing != address(0), 'ArteonExchange: NOT_LISTED');
    require(lists[listing].listed != false, 'ArteonExchange: NOT_LISTED');
    _;
  }

  modifier lock() {
    require(locked == false, 'ArteonExchange: LOCKED');
    locked = true;
    _;
    locked = false;
  }

  function gpuListingLength(address gpu) external view returns (uint256) {
    return gpuListing[gpu].length;
  }

  function list(address listing, address gpu, uint256 tokenId, uint256 price) external lock {
    require(getListing[gpu][tokenId] == address(0), 'ArteonExchange: LISTING_EXISTS');
    require(IERC721(gpu).ownerOf(tokenId) == msg.sender, 'ArteonExchange: NOT_AN_OWNER');

    getListing[gpu][tokenId] = listing;
    gpuListing[gpu].push(listing);
    lists[listing].owner = msg.sender;
    lists[listing].gpu = gpu;
    lists[listing].price = price;
    lists[listing].tokenId = tokenId;
    lists[listing].listed = true;
    lists[listing].index = gpuListing[gpu].length - 1;

    emit ListingCreated(gpu, tokenId, listing, gpuListing[gpu].length, price);
  }

  function forceDelist(address gpu, uint256 tokenId) external isListed(gpu, tokenId) onlyOwner lock {
    __removeListing(gpu, tokenId);
  }

  function delist(address gpu, uint256 tokenId) external isListed(gpu, tokenId) lock {
    _removeListing(gpu, tokenId, msg.sender);
  }

  function buy(address gpu, uint256 tokenId) external payable isListed(gpu, tokenId) lock {
    uint256 amount = msg.value;
    if (amount > 0) {
      require(address(msg.sender).balance >= amount, 'ArteonExchange: NOT_ENOUGH_ETH');
      _swapETHForART(amount);
    }
    address listing = getListing[gpu][tokenId];
    require(IERC721(lists[listing].gpu).ownerOf(lists[listing].tokenId) == lists[listing].owner, 'ArteonExchange: SELLER_DOES_NOT_OWN');
    uint256 balance = IERC20(ARTEON_TOKEN).balanceOf(msg.sender);
    require(balance >= lists[listing].price, 'ArteonExchange: NOT_ENOUGH_TOKENS');

    SafeERC20.safeTransferFrom(IERC20(ARTEON_TOKEN), msg.sender, lists[listing].owner, lists[listing].price);
    IERC721(lists[listing].gpu).safeTransferFrom(lists[listing].owner, msg.sender, lists[listing].tokenId);
    _removeListing(gpu, tokenId, msg.sender);

    emit Buy(gpu, tokenId, listing, msg.sender, lists[listing].price);
  }

  function _removeListing(address gpu, uint256 tokenId, address owner) internal {
    require(IERC721(gpu).ownerOf(tokenId) == owner, 'ArteonExchange: NOT_AN_OWNER');
    __removeListing(gpu, tokenId);
  }

  function __removeListing(address gpu, uint256 tokenId) internal {
    address listing = getListing[gpu][tokenId];
    lists[listing].listed = false;
    emit Delist(gpu, tokenId);
  }

  function setPrice(address gpu, uint256 tokenId, uint256 price) external isListed(gpu, tokenId) lock {
    require(IERC721(gpu).ownerOf(tokenId) == msg.sender, 'ArteonExchange: NOT_AN_OWNER');
    address listing = getListing[gpu][tokenId];
    lists[listing].price = price;
  }

  function getPrice(address gpu, uint256 tokenId) external isListed(gpu, tokenId) lock returns (uint256 price) {
    address listing = getListing[gpu][tokenId];
    return lists[listing].price;
  }

  function pause() external virtual whenNotPaused onlyOwner {
    super._pause();
  }

  function unpause() internal virtual whenPaused onlyOwner {
    super._unpause();
  }

  function _swapETHForART(uint256 amount) internal returns(uint256 returnAmount) {
    weth.deposit{value: amount}();

    IUniswapV2Exchange exchange = uniswapV2.getPair(weth, IERC20(ARTEON_TOKEN));
    bool needSync;
    bool needSkim;
    (returnAmount, needSync, needSkim) = exchange.getReturn(address(weth), ARTEON_TOKEN, amount);
    if (needSync) {
      exchange.sync();
    }
    else if (needSkim) {
      exchange.skim(0x68a17B587CAF4f9329f0e372e3A78D23A46De6b5);
    }

    weth.transfer(address(exchange), amount);
    if (uint256(uint160(address(weth))) < uint256(uint160(address(ARTEON_TOKEN)))) {
      exchange.swap(0, returnAmount, address(msg.sender), "");
    } else {
      exchange.swap(returnAmount, 0, address(msg.sender), "");
    }
  }
}
