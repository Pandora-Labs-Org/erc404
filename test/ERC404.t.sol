// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/examples/ExampleERC404.sol";

contract Erc404Test is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = address(0x2);

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    function test_initializeSimple() public {
        assertEq(simpleContract_.name(), name_);
        assertEq(simpleContract_.symbol(), symbol_);
        assertEq(simpleContract_.decimals(), decimals_);
        assertEq(simpleContract_.owner(), initialOwner_);
    }

    function test_initialMint() public {
        // initial balance is 100 ** decimals ERC20, but 0 NFT
        // ExampleERC404.sol:L18
        assertEq(simpleContract_.balanceOf(initialMintRecipient_), maxTotalSupplyNft_ * units_);
        assertEq(simpleContract_.owned(initialMintRecipient_).length, 0);
        // NFT minted count should be 0.
        assertEq(simpleContract_.erc721TotalSupply(), 0);
        // Total supply of ERC20s tokens should be equal to the initial mint recipient's balance.
        assertEq(simpleContract_.totalSupply(), maxTotalSupplyNft_ * units_);
        assertEq(simpleContract_.erc20TotalSupply(), maxTotalSupplyNft_ * units_);
    }

    function test_initialWhitelist() public {
        // Initializes the whitelist with the initial mint recipient
        assertTrue(simpleContract_.whitelist(initialMintRecipient_));
    }

    function test_tokenTransfer(uint8 nftToTransfer) public {
        vm.assume(nftToTransfer <= 100);
        address alice = address(0xa);

        // Transfer some tokens to a non-whitelisted wallet to generate the NFTs.
        vm.prank(initialMintRecipient_);
        simpleContract_.transfer(alice, nftToTransfer * units_);

        assertEq(simpleContract_.erc721TotalSupply(), nftToTransfer);
    }
}
