// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IArtOnline {
  function mint(address to, uint256 amount) external;
  function burn(address from, uint256 amount) external;
  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function allowance(address owner, address spender) external view returns (uint256);

  function approve(address spender, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function safeTransferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function burnFrom(
    address sender,
    uint256 amount
  ) external;

  event Transfer(address indexed from, address indexed to, uint256 value);

  event Approval(address indexed owner, address indexed spender, uint256 value);
}
