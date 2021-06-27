pragma solidity ^0.8.0;
// SPDX-License-Identifier: MIT

import "./../../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./../../node_modules/@openzeppelin/contracts/utils/Counters.sol";
import './../../node_modules/@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IArteonGPU.sol';

contract ArteonGPU is IArteonGPU, ERC721, Ownable {
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  string private _tokenURI;
  uint256 private _cap;

  constructor(string memory tokenURI_, uint256 cap_, string memory symbol) ERC721('ArteonGpu', symbol) {
    _tokenURI = tokenURI_;
    _cap = cap_;
  }

  function supplyCap() public view virtual override returns (uint256) {
    return _cap;
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _tokenIds.current();
  }

  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
    return _tokenURI;
  }

  function addCard(address to) public override onlyOwner returns (uint256) {
    _tokenIds.increment();

    uint256 _tokenId = _tokenIds.current();
    require(_tokenId <= _cap, 'SUPPLY_CAP_EXCEEDED');
    _mint(to, _tokenId);

    return _tokenId;
  }
}
