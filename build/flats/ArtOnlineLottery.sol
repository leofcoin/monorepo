


contract Initializable {
  uint256 inited = 0;

  modifier initializer() {
    require(inited == 0, "already inited");
    _;
    inited = 1;
  }
}


// OpenZeppelin Contracts v4.4.1 (utils/Address.sol)


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
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
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
  function claim(uint256 id, uint256 ticketId) external returns (bool);
  function getTicketNumbers(uint256 tokenId) external returns (uint256[] memory);
  function claimed(uint256 id, uint256 ticketId) external returns (bool);
}

//SPDX-License-Identifier: MIT


interface IRandomNumberGenerator {
  function getRandomNumber(uint256 lotteryId, uint256 userProvidedSeed) external returns (bytes32 requestId);
}




contract LotteryStorage {
  address internal _manager;
  uint256 internal _lotteryIds;
  ILotteryTickets internal _lotteryTicketsNFT;
  IArtOnline internal _artOnline;
  IRandomNumberGenerator internal _randomNumberGenerator;
  uint256 public _lotterySize;
  uint256 public _maxValidRange;
  bytes32 internal _requestId;

  mapping(uint256 => lottoInfo) internal _lotteries;

  event ChangeManager(address previous, address current);
  event BuyTickets(address indexed owner, uint256 lotteryId, uint256[] numbers, uint256 totalCost);
  event RequestNumbers(uint256 lotteryId, bytes32 requestId);
  event LotteryClose(uint256 lotteryId);
  event LotteryOpen(uint256 lotteryId);
  event UpdateLotterySize(uint256 newLotterySize);
  event ChangeMaxRange(uint256 newMaxRange);

  enum Status {
    NotStarted,     // The lottery has not started yet
    Open,           // The lottery is open for ticket purchases
    Closed,         // The lottery is no longer open for ticket purchases
    Completed       // The lottery has been closed and the numbers drawn
  }
  struct lottoInfo {
    uint256 id;
    Status status;
    uint256 prizePool;
    uint256 ticketPrice;
    uint8[] prizeDistribution;
    uint256 startTime;
    uint256 endTime;
    uint256[] winningNumbers;
  }
}




contract ArtOnlineLottery is Initializable, LotteryStorage {
  using Address for address;

  modifier onlyRandomGenerator() {
    require(msg.sender == address(_randomNumberGenerator), 'Only random generator');
    _;
  }


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

  function setRandomNumberGenerator(address randomNumberGenerator_) external onlyManager {
    _randomNumberGenerator = IRandomNumberGenerator(randomNumberGenerator_);
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

  function createLottery(uint256 startTime_, uint256 endTime_, uint256 _prizePool, uint256 _costPerTicket, uint8[] calldata _prizeDistribution) external virtual onlyManager {
    _lotteryIds += 1;

    require(_prizeDistribution.length == _lotterySize, "Invalid distribution");

    uint256 prizeDistributionTotal = 0;
    for (uint256 i = 0; i < _prizeDistribution.length; i++) {
      prizeDistributionTotal += uint256(_prizeDistribution[i]);
    }

    // 20 percent hardcoded burn in contract
    require(prizeDistributionTotal == 80, "Prize distribution is not 80%");
    require(_prizePool != 0 && _costPerTicket != 0, "Prize or cost cannot be 0");
    require(startTime_ != 0 && startTime_ < endTime_, "Timestamps for lottery invalid");

    uint256 id_ = _lotteryIds;
    uint256[] memory _winningNumbers = new uint256[](_lotterySize);
    lottoInfo memory _lottery = lottoInfo(
      id_,
      Status.Open,
      _prizePool,
      _costPerTicket,
      _prizeDistribution,
      startTime_,
      endTime_,
      _winningNumbers
    );

    _lotteries[id_] = _lottery;

    emit LotteryOpen(id_);
  }

  function drawWinningNumbers(uint256 id_, uint256 seed_) external onlyManager {
    require(_lotteries[id_].endTime <= block.timestamp, 'LOTTERY_OPEN');
    require( _lotteries[id_].status == Status.Open, 'LOTTERY_STATE_ERROR');
    _lotteries[id_].status = Status.Closed;
    _requestId = _randomNumberGenerator.getRandomNumber(id_, seed_);
    emit RequestNumbers(id_, _requestId);
    // requestId_ = _callApi()

    // uint256 burnAmount_ = _lotteries[id_].prizePool - totalWinnings;
    // IArtOnline(_artOnline).burn(burnAmount_);
    //
    // for (uint256 i; i < winners.length; i++) {
    //   IArtOnline(_artOnline).transferFrom(address(this), winner, amount);
    // }

  }

  function numbersDrawn(uint256 _lotteryId, bytes32 requestId_, uint256 _randomNumber) external onlyRandomGenerator() {
     require(_lotteries[_lotteryId].status == Status.Closed, "Draw numbers first");
     if (_requestId == requestId_) {
       _lotteries[_lotteryId].status = Status.Completed;
       _lotteries[_lotteryId].winningNumbers = _split(_randomNumber);
     }
     uint256 burn = (_lotteries[_lotteryId].prizePool / 100) * 20;
     _lotteries[_lotteryId].prizePool -= burn;
     _artOnline.burnFrom(address(this), burn);
     emit LotteryClose(_lotteryId);
   }

  function buyTickets(uint256 id_, uint256 amount, uint256[] memory numbers_) external notContract() {
    require(block.timestamp < _lotteries[id_].endTime, 'LOTTERY_ENDED');
    require(block.timestamp > _lotteries[id_].startTime, 'LOTTERY_NOT_STARTED');
    _artOnline.transferFrom(
      msg.sender,
      address(this),
      amount * _lotteries[id_].ticketPrice
    );

    _lotteryTicketsNFT.mintTickets(id_, msg.sender, amount, numbers_, _lotterySize);
    emit BuyTickets(msg.sender, id_, numbers_, amount * _lotteries[id_].ticketPrice);
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
     require(_lotteryTicketsNFT.claim(_lotteryId, _tokenId), "Numbers for ticket invalid");

     // Getting the number of matching tickets
     uint8 matchingNumbers = _getNumberOfMatching(
       _lotteryTicketsNFT.getTicketNumbers(_tokenId),
       _lotteries[_lotteryId].winningNumbers
     );
     // Getting the prize amount for those matching tickets
     uint256 prizeAmount = _prizeForMatching(
       matchingNumbers,
       _lotteryId
     );
     _lotteries[_lotteryId].prizePool -= prizeAmount;
     _artOnline.transferFrom(address(this), address(receiver), prizeAmount);
   }

  function batchClaimRewards(address receiver, uint256 _lotteryId, uint256[] calldata _tokenIds) external notContract() {
    require(_tokenIds.length <= 50, "Batch claim too large");
    _beforeClaim(_lotteryId);

    uint256 totalPrize = 0;
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      require(_lotteryTicketsNFT.ownerOf(_lotteryId, _tokenIds[i]) == receiver, "Only the owner can claim");
      if(!_lotteryTicketsNFT.claimed(_lotteryId, _tokenIds[i])) {
        require(_lotteryTicketsNFT.claim(_lotteryId, _tokenIds[i]), "Numbers for ticket invalid");
        uint8 matchingNumbers = _getNumberOfMatching(
          _lotteryTicketsNFT.getTicketNumbers(_tokenIds[i]),
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
    _artOnline.transferFrom(address(this), address(receiver), totalPrize);
  }

  function _getNumberOfMatching(uint256[] memory _usersNumbers, uint256[] memory _winningNumbers) internal pure returns(uint8 noOfMatching) {
     // Loops through all wimming numbers
     for (uint256 i = 0; i < _winningNumbers.length; i++) {
       // If the winning numbers and user numbers match
       if(_usersNumbers[i] == _winningNumbers[i]) {
         // The number of matching numbers incrases
         noOfMatching += 1;
       }
     }
   }

 function _prizeForMatching(uint8 _noOfMatching, uint256 _lotteryId) internal view returns(uint256) {
    uint256 prize = 0;
    if(_noOfMatching == 0) {
      return 0;
    }
    uint256 perOfPool = _lotteries[_lotteryId].prizeDistribution[_noOfMatching-1];
    prize = _lotteries[_lotteryId].prizePool * perOfPool;
    return prize / 100;
  }

  function _split(uint256 _randomNumber) internal view returns(uint256[] memory) {
    uint256[] memory winningNumbers = new uint256[](_lotterySize);
    for(uint i = 0; i < _lotterySize; i++){
      // Encodes the random number with its position in loop
      bytes32 hashOfRandom = keccak256(abi.encodePacked(_randomNumber, i));
      // Casts random number hash into uint256
      uint256 numberRepresentation = uint256(hashOfRandom);
      // Sets the winning number position to a uint256 of random hash number
      winningNumbers[i] = uint256(numberRepresentation % _maxValidRange);
    }
    return winningNumbers;
  }

  function withdraw(uint256 amount_) external onlyManager {
    _artOnline.transferFrom(address(this), _manager, amount_);
  }
}
