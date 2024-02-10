//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC404MerkleClaim {
  error AirdropAlreadyClaimed();
  error NotEligibleForAirdrop();
  error AirdropIsClosed();

  function verifyProof(
    bytes32[] memory proof_,
    address claimer_,
    uint256 value_
  ) external view returns (bool);

  function airdropMint(bytes32[] memory proof_, uint256 value_) external;
}
