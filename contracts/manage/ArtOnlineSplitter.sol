// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './../exchange/interfaces/IPanCakeRouter.sol';
import './../access/SetArtOnlineBase.sol';
import './../exchange/interfaces/IArtOnlineExchangeFactory.sol';

contract ArtOnlineSplitter is SetArtOnlineBase {
  mapping (string => uint256) internal _splitFor;
  mapping (string => address) internal _addressFor;

  constructor(
    address bridger,
    address access
  ) SetArtOnlineBase(bridger, access) {}

  function setSplitsBatch(string[] memory names, uint256[] memory splits_) external onlyAdmin() {
    require(names.length == splits_.length, 'INVALID_LENGTH');
    for (uint256 i; i < names.length; i++) {
      _splitFor[names[i]] = splits_[i];
    }
  }

  function setAddressesBatch(string[] memory names, address[] memory addresses) external onlyAdmin() {
    require(names.length == addresses.length, 'INVALID_LENGTH');
    for (uint256 i; i < names.length; i++) {
      _addressFor[names[i]] = addresses[i];
    }
  }

  function splitFor(string memory receiver) external view returns (uint256) {
    return _splitFor[receiver];
  }

  function addressFor(string memory receiver) external view returns (address) {
    return _addressFor[receiver];
  }

  function _swapETHForTokens(uint256 amount, address token, address receiver) internal {
    IPanCakeRouter _pancakeRouter = IPanCakeRouter(_addressFor['router']);
    address[] memory path = new address[](2);
    path[0] = _pancakeRouter.WETH();
    path[1] = token;


    // make the swap
    _pancakeRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amount}(
      amount,
      0, // accept any amount of Tokens
      path,
      receiver,
      block.timestamp + 60
    );
  }

  // address and uint256 defined for future partner pool/splitter contract
  function split(address currency_, uint256 amount) external payable {
    require(amount == msg.value, 'AMOUNTS_DONT_MATCH');

    uint256 partnerSplit = _calculateSplit(amount, 'partner');
    uint256 artOnlineSplit = _calculateSplit(amount, 'artonline');
    uint256 burnSplit = _calculateSplit(artOnlineSplit, 'burn');
    uint256 marketingSplit = _calculateSplit(artOnlineSplit, 'marketing');
    uint256 liquiditySplit = _calculateSplit(artOnlineSplit, 'liquidity');

    // _swapETHForTokens(partnerSplit, _addressFor['partner'], _addressFor['pool']);
    address payable partnerWallet = payable(_addressFor['partner']);
    partnerWallet.transfer(partnerSplit);
    // _swapETHForTokens(burnSplit, _addressFor['artonline'], address(this));
    // IArtOnline artOnlineContract = IArtOnline(_addressFor['artOnline']);
    // artOnlineContract.burn(address(this), artOnlineContract.balanceOf(address(this)));

    address payable burnWallet = payable(_addressFor['burn']);
    burnWallet.transfer(burnSplit);

    address payable marketingWallet = payable(_addressFor['marketing']);
    marketingWallet.transfer(marketingSplit);

    address payable liquidityWallet = payable(_addressFor['liquidity']);
    liquidityWallet.transfer(liquiditySplit);
  }

  function _calculateSplit(uint256 amount, string memory splitReceiver) internal view returns (uint256) {
    return (amount / 100) * _splitFor[splitReceiver];
  }

  function calculateSplit(uint256 amount, string memory splitReceiver) external view returns (uint256) {
    return _calculateSplit(amount, splitReceiver);
  }
}
