// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ERC20Events {
  event Approval(address indexed owner, address indexed spender, uint256 value);
  event Transfer(address indexed from, address indexed to, uint256 amount);
}
