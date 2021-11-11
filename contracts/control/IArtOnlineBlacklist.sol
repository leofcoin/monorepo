interface IArtOnlineBlacklist {
  function blacklist(address account, bool _blacklist) external;
  function blacklisted(address account) external view returns (bool);
}
