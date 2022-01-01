// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./../storage/ArtOnlineStorage.sol";

contract ArtOnline is Context, IERC20, IERC20Metadata, Pausable, IERC20Permit, EIP712, ArtOnlineStorage {
  using Counters for Counters.Counter;
  mapping(address => Counters.Counter) internal _nonces;

  function _isContract(address _addr) internal returns (bool isContract){
    uint32 size;
    assembly {
      size := extcodesize(_addr)
    }
    return (size > 0);
  }

  constructor(address platform_, uint256 cap_) EIP712(_name, "1") {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(PAUSER_ROLE, msg.sender);
    _setupRole(MINT_ROLE, msg.sender);
    _setupRole(MINT_ROLE, platform_);
    _platform = platform_;
    _cap = cap_;
  }

  function name() public view virtual override returns (string memory) {
    return _name;
  }

  function symbol() public view virtual override returns (string memory) {
    return _symbol;
  }

  function decimals() public view virtual override returns (uint8) {
    return 18;
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), to, amount);
    return true;
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    _approve(_msgSender(), spender, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount)
    public virtual override returns (bool) {
    _transfer(from, to, amount);

    uint256 currentAllowance = _allowances[from][_msgSender()];
    require(currentAllowance >= amount, "transfer amount exceeds allowance");
    unchecked {
      _approve(from, _msgSender(), currentAllowance - amount);
    }
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
    uint256 currentAllowance = _allowances[_msgSender()][spender];
    require(currentAllowance >= subtractedValue, "decreased allowance below zero");
    unchecked {
      _approve(_msgSender(), spender, currentAllowance - subtractedValue);
    }
    return true;
  }

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {
    require(from != address(0), "transfer from the zero address");
    require(to != address(0), "transfer to the zero address");

    _beforeTokenTransfer(from, to, amount);

    uint256 fromBalance = _balances[from];
    require(fromBalance >= amount, "transfer amount exceeds balance");
    uint256 burnAmount = burnPercentage(amount);

    unchecked {
      amount = amount - burnAmount;
      _balances[from] = fromBalance - amount;
    }
    _burn(from, burnAmount);
    _balances[to] += amount;

    emit Transfer(from, to, amount);

    _afterTokenTransfer(from, to, amount);
  }

  function _mint(address to, uint256 amount) internal virtual {
    require(to != address(0), "mint to the zero address");

    _beforeTokenTransfer(address(0), to, amount);

    _totalSupply += amount;
    _balances[to] += amount;
    emit Transfer(address(0), to, amount);

    _afterTokenTransfer(address(0), to, amount);
  }

  function _burn(address from, uint256 amount) internal virtual {
    require(from != address(0), "burn from the zero address");

    _beforeTokenTransfer(from, address(0), amount);

    uint256 fromBalance = _balances[from];
    require(fromBalance >= amount, "burn amount exceeds balance");
    unchecked {
      _balances[from] = fromBalance - amount;
    }
    _totalSupply -= amount;

    emit Transfer(from, address(0), amount);

    _afterTokenTransfer(from, address(0), amount);
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), "approve from the zero address");
    require(spender != address(0), "approve to the zero address");

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
    return true;
  }

  function setPlatform(address newPlatform) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(_isContract(newPlatform) == true, 'platform not a contract');
    grantRole(MINT_ROLE, newPlatform);
    require(hasRole(MINT_ROLE, newPlatform) == true, 'platform newrole failure');
    revokeRole(MINT_ROLE, _platform);
    require(hasRole(MINT_ROLE, _platform) != true, 'platform removerole failure');
    _platform = newPlatform;
  }

  function platform() external view virtual returns (address) {
    return _platform;
  }

  function cap() public view virtual returns (uint256) {
    return _cap;
  }

  function pause() public onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  function mint(address to, uint256 amount) public onlyRole(MINT_ROLE) {
    require(totalSupply() + amount <= cap(), "ERC20Capped: cap exceeded");
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) public onlyRole(MINT_ROLE) {
    require(totalSupply() - amount >= 0, "ERC20Capped: cap exceeded");
    _burn(from, amount);
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount)
    internal
    whenNotPaused {}

  function _afterTokenTransfer(
      address from,
      address to,
      uint256 amount
  ) internal virtual {}

  function burnPercentage(uint256 value) public view returns (uint256 percentage)  {
    unchecked {
      percentage = value * percentSettings / 10000;
    }
    return percentage;
  }

  function burn(uint256 amount) external virtual onlyRole(MINT_ROLE) {
    _burn(_msgSender(), amount);
  }

  function burnFrom(address account, uint256 amount) external virtual onlyRole(MINT_ROLE) {
    uint256 currentAllowance = allowance(account, _msgSender());
    require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
    unchecked {
      _approve(account, _msgSender(), currentAllowance - amount);
    }
    _burn(account, amount);
  }

  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public virtual override {
    require(block.timestamp <= deadline, "ERC20Permit: expired deadline");

    bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));

    bytes32 hash = _hashTypedDataV4(structHash);

    address signer = ECDSA.recover(hash, v, r, s);
    require(signer == owner, "ERC20Permit: invalid signature");

    _approve(owner, spender, value);
  }

  function nonces(address owner) public view virtual override returns (uint256) {
    return _nonces[owner].current();
  }

  function DOMAIN_SEPARATOR() external view override returns (bytes32) {
    return _domainSeparatorV4();
  }

  function _useNonce(address owner) internal virtual returns (uint256 current) {
    Counters.Counter storage nonce = _nonces[owner];
    current = nonce.current();
    nonce.increment();
  }
}
