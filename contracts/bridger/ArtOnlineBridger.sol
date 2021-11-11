import 'contracts/access/IArtOnlineAccess.sol';

contract ArtOnlineBridger {
  bytes32 public constant MINT_ROLE = keccak256('MINT_ROLE');
  bytes32 public constant DEFAULT_ADMIN_ROLE = keccak256('DEFAULT_ADMIN_ROLE');

  address internal _artOnline;
  address internal _artOnlinePlatform;
  address internal _artOnlineMining;
  address internal _artOnlineExchange;
  address internal _artOnlineFactory;
  address internal _artOnlineBlacklist;
  address internal _artOnlineAccess;
  address internal _artOnlineBridger;

  modifier hasPermission() {
    require(IArtOnlineAccess(_artOnlineAccess).isAdmin(msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  function setArtOnline(address artonline_) external hasPermission() {
    _artOnline = artonline_;
  }

  function setArtOnlineExchange(address artOnlineExchange_) external hasPermission() {
    _artOnlineExchange = artOnlineExchange_;
  }

  function setArtOnlinePlatform(address artOnlinePlatform_) external hasPermission() {
    _artOnlinePlatform = artOnlinePlatform_;
  }

  function setArtOnlineMining(address artOnlineMining_) external hasPermission() {
    _artOnlineMining = artOnlineMining_;
  }

  function setArtOnlineFactory(address artOnlineFactory_) external hasPermission() {
    _artOnlineFactory = artOnlineFactory_;
  }

  function setArtOnlineBlacklist(address artOnlineBlacklist_) external hasPermission() {
    _artOnlineBlacklist = artOnlineBlacklist_;
  }

  function setArtOnlineAccess(address artOnlineAccess_) external hasPermission() {
    _artOnlineAccess = artOnlineAccess_;
  }

  function artOnline() external view virtual returns (address) {
    return _artOnline;
  }

  function artOnlineExchange() external view virtual returns (address) {
    return _artOnlineExchange;
  }

  function artOnlinePlatform() external view virtual returns (address) {
    return _artOnlinePlatform;
  }

  function artOnlineMining() external view virtual returns (address) {
    return _artOnlineMining;
  }

  function artOnlineFactory() external view virtual returns (address) {
    return _artOnlineFactory;
  }

  function artOnlineBlacklist() external view virtual returns (address) {
    return _artOnlineBlacklist;
  }

  function artOnlineAccess() external view virtual returns (address) {
    return _artOnlineAccess;
  }

  function artOnlineBridger() external view virtual returns (address) {
    return address(this);
  }
}
