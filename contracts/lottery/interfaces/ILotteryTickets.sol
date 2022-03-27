interface ILotteryTickets {
  function mintTickets(uint256 lotteryId, address to, uint256 amount, uint16[] calldata numbers_, uint16 lotterySize) external;
  function ownerOf(uint256 id, uint256 ticketId) external returns (address);
  function claim(uint256 id, uint256 ticketId, uint16 maxRange) external returns (bool);
  function getTicketNumbers(uint256 id, uint256 tokenId) external returns (uint16[] memory);
  function claimed(uint256 id, uint256 ticketId) external returns (bool);
}
