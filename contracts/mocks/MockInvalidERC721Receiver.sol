//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockInvalidERC721Receiver {
  function wrongSelector() external pure {
    // NOOP
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    return MockInvalidERC721Receiver.wrongSelector.selector;
  }
}
