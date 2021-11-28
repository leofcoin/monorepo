pragma solidity 0.8.7;

interface IMintableERC1155Child {
  function deposit(address user, bytes calldata depositData) external;
}
