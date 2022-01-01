import './..//access/IArtOnlineAccess.sol';

contract ArtOnlineBlacklist {
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

  constructor(address artOnlineAccess_) {
    _artOnlineAccess = artOnlineAccess_;
  }

  function setArtOnlineAccess(address artOnlineAccess_) external
    hasPermission()
  {
    _artOnlineAccess = artOnlineAccess_;
  }

  function artOnlineAccess() external returns (address) {
    return _artOnlineAccess;
  }

  function blacklist(address account, bool blacklist_) external
    hasPermission()
    isWhiteListed(account)
  {
    _blacklist[account] = blacklist_ == true ? 1 : 0;
    emit Blacklist(account, blacklist_);
  }

  function blacklisted(address account) external view returns (bool) {
    return _blacklist[account] == 1 ? true : false;
  }
}
