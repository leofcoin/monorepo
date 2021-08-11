pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IWETH is IERC20 {
    function deposit() external payable;
    function transfer(address to, uint value) external override returns (bool);
    function withdraw(uint amount) external;
    function approve(address guy, uint wad) external override returns (bool);
    function allowance(address guy) external returns (uint);
}
