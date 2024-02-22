//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC404} from "../ERC404.sol";
import {ERC404UniswapV2Exempt} from "../extensions/ERC404UniswapV2Exempt.sol";

contract ERC404ExampleUniswapV2 is Ownable, ERC404, ERC404UniswapV2Exempt {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 maxTotalSupplyERC721_,
    address initialOwner_,
    address initialMintRecipient_,
    address uniswapV2Router_
  )
    ERC404(name_, symbol_, decimals_)
    Ownable(initialOwner_)
    ERC404UniswapV2Exempt(uniswapV2Router_)
  {
    // Do not mint the ERC721s to the initial owner, as it's a waste of gas.
    _setERC721TransferExempt(initialMintRecipient_, true);
    _mintERC20(initialMintRecipient_, maxTotalSupplyERC721_ * units);
  }

  function tokenURI(uint256 id_) public pure override returns (string memory) {
    return string.concat("https://example.com/token/", Strings.toString(id_));
  }

  function setERC721TransferExempt(
    address account_,
    bool value_
  ) external onlyOwner {
    _setERC721TransferExempt(account_, value_);
  }
}
