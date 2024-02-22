// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ERC721Events {
  event ApprovalForAll(
    address indexed owner,
    address indexed operator,
    bool approved
  );
  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 indexed id
  );
  event Transfer(address indexed from, address indexed to, uint256 indexed id);
}
