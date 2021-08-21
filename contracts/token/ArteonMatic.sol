pragma solidity 0.8.0;

import './Arteon.sol';

contract ArteonMatic is Arteon {
  address public childChainManagerProxy;


  modifier onlyGoverner() {
    require(msg.sender == governance, 'Arteon: only governer!');
    _;
  }

  modifier onlyManager() {
    require(msg.sender == childChainManagerProxy, 'Arteon: only manager!');
    _;
  }

  constructor(string memory name_, string memory symbol_, address _childChainManagerProxy) Arteon(name_, symbol_) {
    childChainManagerProxy = _childChainManagerProxy;
  }

  function updateChildChainManager(address newChildChainManagerProxy) external onlyGoverner {
    require(newChildChainManagerProxy != address(0), 'ArteonMatic: zero address not allowed');

    childChainManagerProxy = newChildChainManagerProxy;
  }
  // todo to burn or not to burn
  function withdraw(uint256 amount) external {
    _balances[msg.sender] = _balances[msg.sender].sub (amount, 'ArteonMatic: burn amount axceeds balance!');
    _totalSupply = _totalSupply.sub(amount);

    emit Transfer(msg.sender, address(0), amount);
  }

  // todo to burn or not to burn 
  function deposit(address user, bytes calldata data) external onlyManager {
    uint256 amount = abi.decode(data, (uint256));
    _totalSupply = _totalSupply.add(amount);
    _balances[msg.sender] = _balances[msg.sender].add(amount);

    emit Transfer(address(0), msg.sender, amount);
  }
}
