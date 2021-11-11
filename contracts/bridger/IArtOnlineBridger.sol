interface IArtOnlineBridge {
  function setArtOnline(address _address) external;
  function artOnline() external view returns (address);

  function setArtOnlineExchange(address _address) external;
  function artOnlineExchange() external view returns (address);

  function setArtOnlinePlatform(address _address) external;
  function artOnlinePlatform() external view returns (address);

  function setArtOnlineBlacklist(address _address) external;
  function artOnlineBlacklist() external view returns (address);

  function setArtOnlineMining(address _address) external;
  function artOnlineMining() external view returns (address);

  function setArtOnlineBridge(address _address) external;
  function artOnlineBridge() external view returns (address);

  function setArtOnlineFactory(address _address) external;
  function artOnlineFactory() external view returns (address);
}
