//SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
  ) public view virtual returns (bool) {
    bytes32 leaf = keccak256(
      bytes.concat(keccak256(abi.encode(claimer_, value_)))
    );
    if (MerkleProof.verify(proof_, airdropMerkleRoot, leaf)) {
      return true;
    }
    return false;
  }

  // Pass in value_ as the amount of tokens to mint in ERC-20 format (i.e. wei, if using decimals 18).
  function airdropMintERC20(
    bytes32[] memory proof_,
    uint256 value_
  ) public virtual whenAirdropIsOpen {
    // Validate and record the airdrop claim so they can't claim it twice.
    _validateAndRecordAirdropClaim(proof_, msg.sender, value_);
    // Mint the user's airdrop to them.
    _mintERC20(msg.sender, value_);
  }

  function _setAirdropMerkleRoot(bytes32 airdropMerkleRoot_) virtual internal {
    airdropMerkleRoot = airdropMerkleRoot_;
  }

  function _setAirdropIsOpen(bool state_) virtual internal {
    airdropIsOpen = state_;
  }

  function _validateAndRecordAirdropClaim(
    bytes32[] memory proof_,
    address claimer_,
    uint256 value_
  ) internal virtual {
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
