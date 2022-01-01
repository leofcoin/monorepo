// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IPanCakeRouter {
  function WETH() external view returns (address);
  function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
  function swapExactTokensForTokens(uint256, uint256, address[] memory, address, uint256) external returns (uint256[] memory amounts);
  function swapExactETHForTokens(uint256, uint256, address[] memory, address, uint256) external payable returns ( uint256[] memory amounts);
  function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, uint256, address[] memory, address, uint256) external payable returns ( uint256[] memory amounts);
}
