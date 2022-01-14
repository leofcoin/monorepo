pragma solidity 0.8.11;

contract Initializable {
  uint256 inited = 0;

  modifier initializer() {
    require(inited == 0, "already inited");
    _;
    inited = 1;
  }
}
