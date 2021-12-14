import 'contracts/access/IArtOnlineAccess.sol';

contract ArtOnlineBridger {
  address internal _artOnline;
  address internal _artOnlinePlatform;
  address internal _artOnlineMining;
  address internal _artOnlineExchange;
  address internal _artOnlineExchangeFactory;
  address internal _artOnlineFactory;
  address internal _artOnlineBlacklist;
  address internal _artOnlineAccess;
  address internal _artOnlineBridger;
  address internal _artOnlineStaking;

  modifier hasPermission() {
    require(IArtOnlineAccess(_artOnlineAccess).isAdmin(msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  constructor(address artOnlineAccess_) {
    _artOnlineAccess = artOnlineAccess_;
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

  function setArtOnlineExchangeFactory(address artOnlineExchangeFactory_) external hasPermission() {
    _artOnlineExchangeFactory = artOnlineExchangeFactory_;
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

  function setArtOnlineStaking(address artOnlineStaking_) external hasPermission() {
    _artOnlineStaking = artOnlineStaking_;
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

  function artOnlineExchangeFactory() external view virtual returns (address) {
    return _artOnlineExchangeFactory;
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

  function artOnlineStaking() external view virtual returns (address) {
    return _artOnlineStaking;
  }

  function artOnlineBridger() external view virtual returns (address) {
    return address(this);
  }
}
