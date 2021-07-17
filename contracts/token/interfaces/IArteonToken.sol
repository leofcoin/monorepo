import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IArteonToken is IERC20 {
  function burnPercentage(uint256 value) external returns (uint256);
}
