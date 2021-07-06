interface IArteonMinerHolder {
  function _activateGPU(address account, uint256 tokenId) external;
  function _deactivateGPU(address account, uint256 tokenId) external;
  function balanceOf(address account) external returns (uint256);
}
