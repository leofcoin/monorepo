interface IArtOnlineAccess {
  function hasRole(bytes32, address account) external returns (bool);
  function isAdmin(address account) external returns (bool);
  function isMinter(address account) external returns (bool);
}
