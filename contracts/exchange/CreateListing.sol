import './ArtOnlineListing.sol';
import './ArtOnlineListingERC1155.sol';
library CreateListing {
  function ERC721(address owner, address contractAddress, uint256 id, uint256 price, address currency) internal returns (address listing) {
    bytes memory bytecode = type(ArtOnlineListing).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(contractAddress, id, currency));
    assembly {
      listing := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    ArtOnlineListing(listing).initialize(owner, contractAddress, id, price, currency);
    return listing;
  }

  function ERC1155(address owner, address contractAddress, uint256 id, uint256 tokenId, uint256 price, address currency) internal returns (address listing) {
    bytes memory bytecode = type(ArtOnlineListing).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(contractAddress, id, currency));
    assembly {
      listing := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    ArtOnlineListingERC1155(listing).initialize(owner, contractAddress, id, tokenId, price, currency);
    return listing;
  }
}
