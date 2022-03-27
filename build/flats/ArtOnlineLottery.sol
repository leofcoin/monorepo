


contract Initializable {
  uint256 inited = 0;

  modifier initializer() {
    require(inited == 0, "already inited");
    _;
    inited = 1;
  }
}


// OpenZeppelin Contracts (last updated v4.5.0) (utils/Address.sol)


/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCall(target, data, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");

        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        require(isContract(target), "Address: static call to non-contract");

        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(isContract(target), "Address: delegate call to non-contract");

        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verifies that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}





interface IArtOnline {
  function mint(address to, uint256 amount) external;
  function burn(address from, uint256 amount) external;
  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function allowance(address owner, address spender) external view returns (uint256);

  function approve(address spender, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function safeTransferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function burnFrom(
    address sender,
    uint256 amount
  ) external;

  event Transfer(address indexed from, address indexed to, uint256 value);

  event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface ILotteryTickets {
  function mintTickets(uint256 lotteryId, address to, uint256 amount, uint256[] calldata numbers_, uint256 lotterySize) external;
  function ownerOf(uint256 id, uint256 ticketId) external returns (address);
  function claim(uint256 id, uint256 ticketId, uint256 maxRange) external returns (bool);
  function getTicketNumbers(uint256 id, uint256 tokenId) external returns (uint256[] memory);
  function claimed(uint256 id, uint256 ticketId) external returns (bool);
}

//SPDX-License-Identifier: MIT


interface IRandomNumberGenerator {
  function getRandomNumber(uint256 lotteryId) external returns (bytes32 requestId);
}



contract LotteryStorage {
  address internal _manager;
  uint256 internal _lotteryIds;
  ILotteryTickets internal _lotteryTicketsNFT;
  IArtOnline internal _artOnline;
  uint256 public _lotterySize;
  uint256 public _maxValidRange;

  mapping(uint256 => lottoInfo) internal _lotteries;
  mapping(uint256 => uint256) internal _burns;
  mapping(uint256 => uint256[]) internal _winningNumbers;

  event ChangeManager(address previous, address current);
  event BuyTickets(address indexed owner, uint256 lotteryId, uint256[] numbers, uint256 totalCost);
  event LotteryClose(uint256 lotteryId, uint256[] winningNumbers, uint256 burns);
  event LotteryOpen(uint256 lotteryId);
  event UpdateLotterySize(uint256 newLotterySize);
  event ChangeMaxRange(uint256 newMaxRange);

  enum Status {
    NotStarted,     // The lottery has not started yet
    Open,           // The lottery is open for ticket purchases
    Completed       // The lottery has been closed and the numbers drawn
  }
  struct lottoInfo {
    uint256 id;
    Status status;
    uint256 prizePool;
    uint256 ticketPrice;
    uint256[] prizeDistribution;
    uint256[] totalMatches;
    uint256 startTime;
    uint256 endTime;
    uint256[] winningNumbers;
    string proof;
  }
}



contract ArtOnlineLottery is Initializable, LotteryStorage {
  using Address for address;

  modifier onlyManager() {
    require(msg.sender == _manager, 'ONLY_MANAGER');
    _;
  }

  modifier notContract() {
    require(!address(msg.sender).isContract(), 'CONTRACTS_NOT_ALLOWED');
    _;
  }

  function initialize() external initializer {
    emit ChangeManager(_manager, msg.sender);
    _manager = msg.sender;
  }

  function setMaxRange(uint256 maxRange_) external onlyManager {
    _maxValidRange = maxRange_;
    emit ChangeMaxRange(maxRange_);
  }

  function maxRange() external view returns(uint256) {
    return _maxValidRange;
  }

  function changeLotteryTicketsNFT(address lotteryTicketsAddress_) external virtual onlyManager {
    _lotteryTicketsNFT = ILotteryTickets(lotteryTicketsAddress_);
  }

  function changeArtOnline(address artOnline_) external virtual onlyManager {
    _artOnline = IArtOnline(artOnline_);
  }

  function setLotterySize(uint256 lotterySize_) external onlyManager {
    _lotterySize = lotterySize_;
  }

  function lotterySize() external view virtual returns (uint256) {
    return _lotterySize;
  }

  function changeManager(address manager_) external virtual onlyManager {
    emit ChangeManager(_manager, manager_);
    _manager = manager_;
  }

  function lotteries() external view returns (uint256) {
    return _lotteryIds;
  }

  function lottery(uint256 id_) external view returns (lottoInfo memory) {
    return _lotteries[id_];
  }

  function topUp(uint256 amount) external {
    _artOnline.transferFrom(
      msg.sender,
      address(this),
      amount
    );
    _lotteries[_lotteryIds].prizePool += amount;
  }

  function createLottery(uint256 startTime_, uint256 endTime_, uint256 _costPerTicket, uint256[] calldata _prizeDistribution) external virtual onlyManager {
    uint256 _prizePool = _artOnline.balanceOf(address(this));
    _lotteryIds += 1;

    require(_prizePool != 0 && _costPerTicket != 0, "Prize or cost cannot be 0");
    require(startTime_ != 0 && startTime_ < endTime_, "Timestamps for lottery invalid");
    require(_prizeDistribution.length == _lotterySize, "Invalid distribution");

    uint256 prizeDistributionTotal = 0;
    for (uint256 i = 0; i < _prizeDistribution.length; i++) {
      prizeDistributionTotal += uint256(_prizeDistribution[i]);
    }
    require(prizeDistributionTotal == 100, "Prize distribution is not 100%");

    uint256 id_ = _lotteryIds;
    uint256[] memory _winningNumbers = new uint256[](_lotterySize);
    uint256[] memory _totalMatches = new uint256[](_lotterySize);

    lottoInfo memory _lottery = lottoInfo(
      id_,
      Status.Open,
      _prizePool,
      _costPerTicket,
      _prizeDistribution,
      _totalMatches,
      startTime_,
      endTime_,
      _winningNumbers,
      '0x0'
    );

    _lotteries[id_] = _lottery;

    emit LotteryOpen(id_);
  }

  function revealWinningNumbers(uint256 lottery_, uint256[] memory winningNumbers_, uint256[] memory totalMatches_, string memory proof) external onlyManager {
    require(_lotteries[lottery_].endTime <= block.timestamp, 'LOTTERY_OPEN');
    require( _lotteries[lottery_].status == Status.Open, 'LOTTERY_STATE_ERROR');
    // require(_lotteries[lottery_].endTime + 60 <= block.timestamp, 'LOTTERY_END_DELAY');

    uint256[] memory _winningNumbers = new uint256[](_lotterySize);
    for (uint256 i = 0; i < winningNumbers_.length; i++) {
      _winningNumbers[i] = uint256(winningNumbers_[i] % _maxValidRange);
    }

    _lotteries[lottery_].winningNumbers = _winningNumbers;
    _lotteries[lottery_].proof = proof;
    _lotteries[lottery_].status = Status.Completed;
    _lotteries[lottery_].totalMatches = totalMatches_;

    _artOnline.burn(address(this), _burns[lottery_]);

    emit LotteryClose(lottery_, _winningNumbers, _burns[lottery_]);
  }

  function buyTickets(uint256 id_, uint256 tickets, uint256[] memory numbers_) external notContract() {
    require(block.timestamp < _lotteries[id_].endTime, 'LOTTERY_ENDED');
    require(block.timestamp > _lotteries[id_].startTime, 'LOTTERY_NOT_STARTED');
    uint256 amount = tickets * _lotteries[id_].ticketPrice;

    _artOnline.transferFrom(
      msg.sender,
      address(this),
      amount
    );

    uint256 burnAmount_ = amount * 2 / 100;
    _lotteries[id_].prizePool += amount - burnAmount_;
    _burns[id_] += burnAmount_;
    _lotteryTicketsNFT.mintTickets(id_, msg.sender, tickets, numbers_, _lotterySize);
    emit BuyTickets(msg.sender, id_, numbers_, tickets);
  }

  function latestLottery() external view virtual returns (lottoInfo memory) {
    return (_lotteries[_lotteryIds]);
  }

  function timestamp() external view virtual returns (uint256) {
    return block.timestamp;
  }

  function _beforeClaim(uint256 _lotteryId) internal {
    require(_lotteries[_lotteryId].endTime <= block.timestamp, "Wait till end to claim");
    require(_lotteries[_lotteryId].status == Status.Completed, "Winning Numbers not chosen yet");
  }

  function claimReward(address receiver, uint256 _lotteryId, uint256 _tokenId) external notContract() {
     _beforeClaim(_lotteryId);
     address owner = _lotteryTicketsNFT.ownerOf(_lotteryId, _tokenId);
     require(owner == receiver, "Only the owner can claim");
     require(_lotteryTicketsNFT.claim(_lotteryId, _tokenId, _maxValidRange), "Numbers for ticket invalid");

     // Getting the number of matching tickets
     uint256 matchingNumbers = _getNumberOfMatching(
       _lotteryTicketsNFT.getTicketNumbers(_lotteryId, _tokenId),
       _lotteries[_lotteryId].winningNumbers
     );
     // Getting the prize amount for those matching tickets
     uint256 prizeAmount = _prizeForMatching(
       matchingNumbers,
       _lotteryId
     );
     _lotteries[_lotteryId].prizePool -= prizeAmount;
     _artOnline.transfer(address(receiver), prizeAmount);
   }

  function batchClaimRewards(address receiver, uint256 _lotteryId, uint256[] calldata _tokenIds) external notContract() {
    require(_tokenIds.length <= 50, "Batch claim too large");
    _beforeClaim(_lotteryId);

    uint256 totalPrize = 0;
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      require(_lotteryTicketsNFT.ownerOf(_lotteryId, _tokenIds[i]) == receiver, "Only the owner can claim");
      if(!_lotteryTicketsNFT.claimed(_lotteryId, _tokenIds[i])) {
        require(_lotteryTicketsNFT.claim(_lotteryId, _tokenIds[i], _maxValidRange), "Numbers for ticket invalid");
        uint256 matchingNumbers = _getNumberOfMatching(
          _lotteryTicketsNFT.getTicketNumbers(_lotteryId, _tokenIds[i]),
          _lotteries[_lotteryId].winningNumbers
        );
        uint256 prizeAmount = _prizeForMatching(
          matchingNumbers,
          _lotteryId
        );
        unchecked {
          _lotteries[_lotteryId].prizePool -= prizeAmount;
          totalPrize += prizeAmount;
        }
      }
    }
    _artOnline.transfer(address(receiver), totalPrize);
  }

  function _getNumberOfMatching(uint256[] memory _usersNumbers, uint256[] memory _winningNumbers) internal pure returns(uint256 noOfMatching) {
     for (uint256 i = 0; i < _winningNumbers.length; i++) {
       if(_usersNumbers[i] == _winningNumbers[i]) {
         noOfMatching += 1;
       }
     }
     return noOfMatching;
   }

 function _prizeForMatching(uint256 _noOfMatching, uint256 _lotteryId) internal view returns(uint256) {
    uint256 prize = 0;
    if(_noOfMatching == 0) {
      return 0;
    }
    uint256 perOfPool = _lotteries[_lotteryId].prizeDistribution[_noOfMatching-1];
    uint256 totalMatches = _lotteries[_lotteryId].totalMatches[_noOfMatching-1];
    prize = _lotteries[_lotteryId].prizePool * perOfPool / totalMatches;
    return prize / 100;
  }

  function withdraw(uint256 amount_) external onlyManager {
    _artOnline.transferFrom(address(this), _manager, amount_);
  }
}
