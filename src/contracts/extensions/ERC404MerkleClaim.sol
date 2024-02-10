//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC404MerkleClaim} from "./IERC404MerkleClaim.sol";

abstract contract ERC404MerkleClaim is IERC404MerkleClaim {
  bool public airdropIsOpen;
  bytes32 public airdropMerkleRoot;
  mapping(address => bool) public hasClaimedAirdrop;

  modifier whenAirdropIsOpen() {
    if (airdropMerkleRoot == 0 || !airdropIsOpen) {
      revert AirdropIsClosed();
    }
    _;
  }

  function verifyProof(
    bytes32[] memory proof_,
    address claimer_,
    uint256 value_
  ) public view returns (bool) {
    bytes32 leaf = keccak256(
      bytes.concat(keccak256(abi.encode(claimer_, value_)))
    );
    if (MerkleProof.verify(proof_, airdropMerkleRoot, leaf)) {
      return true;
    }
    return false;
  }

  // To use, override this function in your contract, call
  // super.airdropMint(proof_) within your override function, then mint tokens.
  function airdropMint(
    bytes32[] memory proof_,
    uint256 value_
  ) public virtual whenAirdropIsOpen {
    _validateAndRecordAirdropClaim(proof_, msg.sender, value_);
  }

  function _setAirdropMerkleRoot(bytes32 airdropMerkleRoot_) internal {
    airdropMerkleRoot = airdropMerkleRoot_;
  }

  function _toggleAirdropIsOpen() internal {
    airdropIsOpen = !airdropIsOpen;
  }

  function _validateAndRecordAirdropClaim(
    bytes32[] memory proof_,
    address claimer_,
    uint256 value_
  ) internal {
    // Check that the address is eligible.
    if (!verifyProof(proof_, claimer_, value_)) {
      revert NotEligibleForAirdrop();
    }

    // Check if address has already claimed their airdrop.
    if (hasClaimedAirdrop[claimer_]) {
      revert AirdropAlreadyClaimed();
    }

    // Mark address as claimed.
    hasClaimedAirdrop[claimer_] = true;
  }
}
