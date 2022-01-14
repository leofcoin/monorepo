// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

library StorageSlot {
  function getDataAt(bytes32 slot) internal view returns (bytes32 data_) {
    assembly {
      data_ := sload(slot)
    }
  }

  function setDataAt(bytes32 slot, bytes32 data_) internal {
    assembly {
      sstore(slot, data_)
    }
  }

  function getAddressAt(bytes32 slot) internal view returns (address address_) {
    assembly {
      address_ := sload(slot)
    }
  }

  function setAddressAt(bytes32 slot, address address_) internal {
    assembly {
      sstore(slot, address_)
    }
  }
}
