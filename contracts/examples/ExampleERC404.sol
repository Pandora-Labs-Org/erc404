//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC404} from "../ERC404.sol";
import {ERC404MerkleClaim} from "../extensions/ERC404MerkleClaim.sol";

contract ExampleERC404 is Ownable, ERC404, ERC404MerkleClaim {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 maxTotalSupplyERC721_,
    address initialOwner_,
    address initialMintRecipient_
  ) ERC404(name_, symbol_, decimals_) Ownable(initialOwner_) {
    // Do not mint the ERC721s to the initial owner, as it's a waste of gas.
    _setWhitelist(initialMintRecipient_, true);
    _mintERC20(initialMintRecipient_, maxTotalSupplyERC721_ * units, false);
  }

  function tokenURI(uint256 id_) public pure override returns (string memory) {
    return string.concat("https://example.com/token/", Strings.toString(id_));
  }

  function airdropMint(
    bytes32[] memory proof_,
    uint256 value_
  ) public override whenAirdropIsOpen {
    super.airdropMint(proof_, value_);
    _mintERC20(msg.sender, value_, true);
  }

  function setAirdropMerkleRoot(bytes32 airdropMerkleRoot_) external onlyOwner {
    _setAirdropMerkleRoot(airdropMerkleRoot_);
  }

  function toggleAirdropIsOpen() external onlyOwner {
    _toggleAirdropIsOpen();
  }

  function setWhitelist(address account_, bool value_) external onlyOwner {
    _setWhitelist(account_, value_);
  }
}
