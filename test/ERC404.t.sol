// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/contracts/examples/ExampleERC404.sol";

contract Erc404Test is Test {
    ExampleERC404 public pandora;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = address(0x2);

    function setUp() public {
        pandora = new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    function test_initializeSimple() public {
        assertEq(pandora.name(), name_);
        assertEq(pandora.symbol(), symbol_);
        assertEq(pandora.decimals(), decimals_);
        assertEq(pandora.owner(), initialOwner_);

        // initial balance is 100 ** decimals ERC20, but 0 NFT
        // ExampleERC404.sol:L18
        assertEq(pandora.balanceOf(initialMintRecipient_), maxTotalSupplyNft_ * 10 ** decimals_);
        assertEq(pandora.owned(initialMintRecipient_).length, 0);
    }
}
