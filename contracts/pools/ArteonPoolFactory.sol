pragma solidity ^0.8.0;

import './../miner/ArteonMiner.sol';
import './../miner/interfaces/IArteonMiner.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract ArteonPoolFactory is Ownable {
  mapping (address => address) public getToken;
  mapping (address => mapping (address => address)) public getListed;
  address[] public listedTokens;
  event TokenAdded(address listedToken, uint);

  function tokens() external view returns (uint) {
    return listedTokens.length;
  }

  function addToken(address gpu, address token, uint256 blockTime, uint256 maxReward, uint256 halvings) external onlyOwner returns (address listedToken) {
    require(getListed[token][gpu] == address(0), 'ArteonPool: LISTING_EXISTS');
    // require(IERC20(token).owner() == msg.sender, 'ArteonPool: NOT_AN_OWNER');

    bytes memory bytecode = type(ArteonMiner).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(token, gpu));
    assembly {
      listedToken := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }

    IArteonMiner(listedToken).initialize(token, gpu, blockTime, maxReward, halvings);
    getToken[token] = listedToken;
    getToken[listedToken] = token;
    getListed[token][gpu];
    listedTokens.push(listedToken);

    emit TokenAdded(listedToken, listedTokens.length);
    return listedToken;
  }
}
