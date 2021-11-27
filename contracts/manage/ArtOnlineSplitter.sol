contract ArtOnlineSplitter is SetArtOnlineBase {
  address internal _token;
  address internal _factory;
  address internal _marketing;
  address internal _partner;
  address internal _partnerPool;

  address[] internal _splits;
  mapping (address => uint256) internal _splitFor;

  constructor(
    address token_,
    address bridger,
    address access
  ) SetArtOnlineBase(bridger, access) {
    _token = token_;
  }

  function setWrappedCurrency(address wrappedCurrency_) external onlyAdmin() {
    _wrappedCurrency = wrappedCurrency_;
  }

  function wrappedCurrency() external pure returns (string memory) {
    return _wrappedCurrency;
  }

  function setToken(address token_) external onlyAdmin() {
    _token = token_;
  }

  function token() external pure returns (string memory) {
    return _token;
  }

  function setFactory(address factory_) external onlyAdmin() {
    _factory = factory_;
  }

  function factory() external pure returns (address) {
    return _factory;
  }

  function setMarketing(address marketing_) external onlyAdmin() {
    _marketing = marketing_;
  }

  function marketing() external pure returns (address) {
    return _marketing;
  }

  function setPartner(address partner_) external onlyAdmin() {
    _partner = partner_;
  }

  function partner() external pure returns (address) {
    return _partner;
  }

  function setPartnerPool(address partnerPool_) external onlyAdmin() {
    _partnerPool = partnerPool_;
  }

  function partnerPool() external pure returns (address) {
    return _partnerPool;
  }

  function splitter(uint256 index) external pure returns (address) {
    return _splits[index];
  }

  function splits() external pure returns (uint256) {
    return _splits.length;
  }

  function splitFor(address receiver) external pure returns (address) {
    return _splitFor[receiver];
  }

  function split(uint256 amount) external {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    uint256 partnerSplit = _splitFor(amount, 'partner');
    uint256 artOnlineSplit = _splitFor(amount, 'artOnline');
    uint256 burnSplit = _splitFor(artOnlineSplit, 'burn');
    uint256 marketingSplit = _splitFor(artOnlineSplit, 'marketing');
    uint256 liquiditySplit = _splitFor(artOnlineSplit, 'liquidity');

    _burnArtOnline(burnSplit);
    _BuyPartner(partnerSplit);
    address payable marketingWallet = payable(_marketing);
    address payable liquidityWallet = payable(_liquidity);

    marketingWallet.transfer(marketingSplit);
    liquidityWallet.transfer(liquiditySplit);
  }

  function _BuyPartner(uint256 amount) internal {
    address[] memory path = _getPath(_wrappedCurrency, _partner);
    IWrappedCurrency(_wrappedCurency).approve(_router, amount);
    IPancakeRouter(_router).swapExactTokensForTokens(
      amount,
      _getAmountOutMin(_wrappedCurrency, _partner, amount),
      _getPath(_wrappedCurrency, _partner),
      address(this),
      block.timestamp + 60
    )
    SafeERC20(IERC20(_partner)).safeTransferFrom(address(this), _partnerPool, amount);
  }

  function _burnArtOnline(uint256 amount) internal {
    address[] memory path = _getPath(_wrappedCurrency, _artOnline);
    IWrappedCurrency(_wrappedCurency).approve(_router, amount);
    IPancakeRouter(_router).swapExactTokensForTokens(
      amount,
      _getAmountOutMin(_wrappedCurrency, _artOnline, amount),
      _getPath(_wrappedCurrency, _artOnline),
      address(this),
      block.timestamp + 60
    )
    IArtOnline.burn(address(this), amount);
  }

  function _splitFor(uint256 amount, string memory splitReceiver) internal returns (uint256) {
    return (amount / 100) * _splitFor[splitReceiver];
  }

  function splitFor(uint256 amount, address splitReceiver) external returns (uint256) {
    return _splitFor();
  }

  function _getPath(address _tokenIn, address _tokenOut) internal returns (address[] memory path){
    if (_tokenIn == _wrappedCurrency || _tokenOut == _wrappedCurrency) {
      path = new address[](2);
      path[0] = _tokenIn;
      path[1] = _tokenOut;
    } else {
      path = new address[](3);
      path[0] = _tokenIn;
      path[1] = _wrappedCurrency;
      path[2] = _tokenOut;
    }
  }

  function _getAmountOutMin(address _tokenIn, address _tokenOut, uint256 _amountIn) internal view returns (uint256) {
    address[] memory path = _getPath(address _tokenIn, address _tokenOut);
    uint256[] memory amountOutMins = IPancakeRouter(_router).getAmountsOut(_amountIn, path);
    return amountOutMins[path.length -1];
  }
}
