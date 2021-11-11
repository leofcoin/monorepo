import 'contracts/access/IArtOnlineAccess.sol';

abstract contract ArtOnlineBlacklist {
  address internal _artOnlineAccess;
  mapping (address => uint256) internal _blacklist;

  event Blacklist(address indexed account, bool indexed);

  modifier isWhiteListed(address account) {
    require(_blacklist[account] == 0, 'BLACKLISTED');
    _;
  }

  modifier hasPermission() {
    bool hasRole = IArtOnlineAccess(_artOnlineAccess).isAdmin(msg.sender);
    require(hasRole == true, 'NO_PERMISSION');
    _;
  }

  function setArtOnlineAccess(address artOnlineAccess_) external
    hasPermission()
  {
    _artOnlineAccess = artOnlineAccess_;
  }

  function artOnlineAccess() external returns (address) {
    return _artOnlineAccess;
  }

  function blacklist(address account, bool _blacklist) external
    hasPermission()
    isWhiteListed(account)
  {
    _blacklist[account] = _blacklist == true ? 1 : 0;
    emit Blacklist(account, _blacklist);
  }

  function blacklisted() external view returns (bool) {
    return _blacklist == 1 ? true : false;
  }
}
