// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IArtOnlineBridger {
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

  function setArtOnlineStaking(address _address) external;
  function artOnlineStaking() external view returns (address);

  function setArtOnlineAccess(address _address) external;
  function artOnlineAccess() external view returns (address);

  function setArtOnlineExchangeFactory(address _address) external;
  function artOnlineExchangeFactory() external view returns (address);
}
