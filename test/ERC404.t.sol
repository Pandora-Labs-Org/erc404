// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/examples/ExampleERC404.sol";
import "../src/interfaces/IERC404.sol";
import {console} from "forge-std/console.sol";

contract Erc404Test is Test {
  ExampleERC404 public simpleContract_;

  string internal name_ = "Example";
  string internal symbol_ = "EXM";
  uint8 internal decimals_ = 18;
  uint256 internal maxTotalSupplyNft_ = 100;

  address internal initialOwner_ = address(0x1);
  address internal initialMintRecipient_ = address(0x2);
  address internal poolAddr = address(0x3);

  error OwnableUnauthorizedAccount(address account);

  function setUp() public {
    simpleContract_ = new ExampleERC404(
      name_,
      symbol_,
      decimals_,
      maxTotalSupplyNft_,
      initialOwner_,
      initialMintRecipient_
    );
  }

  function test_initializeSimple() public {
    assertEq(simpleContract_.name(), name_);
    assertEq(simpleContract_.symbol(), symbol_);
    assertEq(simpleContract_.decimals(), decimals_);
    assertEq(simpleContract_.owner(), initialOwner_);

    // initial balance is 100 ** decimals ERC20, but 0 NFT
    // ExampleERC404.sol:L18
    assertEq(
      simpleContract_.balanceOf(initialMintRecipient_),
      maxTotalSupplyNft_ * 10 ** decimals_
    );
    assertEq(simpleContract_.owned(initialMintRecipient_).length, 0);
  }

  function test_constructor_revert_DecimalsTooLow() public {
    vm.expectRevert(abi.encodeWithSelector(IERC404.DecimalsTooLow.selector));
    new ExampleERC404(
      name_,
      symbol_,
      1,
      maxTotalSupplyNft_,
      initialOwner_,
      initialMintRecipient_
    );
  }

  function test_tokenURI() public {
    string memory uri = simpleContract_.tokenURI(1);
    assertEq(uri, "https://example.com/token/1");
  }

  function test_toggleAirdropIsOpen_revert_OwnableUnauthorizedAccount() public {
    vm.startPrank(initialMintRecipient_);
    vm.expectRevert(
      abi.encodeWithSelector(
        OwnableUnauthorizedAccount.selector,
        initialMintRecipient_
      )
    );
    simpleContract_.toggleAirdropIsOpen();
    vm.stopPrank();
  }

  function test_toggleAirdropIsOpen_success() public {
    vm.startPrank(initialOwner_);
    assertEq(simpleContract_.airdropIsOpen(), false);
    simpleContract_.toggleAirdropIsOpen();
    assertEq(simpleContract_.airdropIsOpen(), true);
    vm.stopPrank();
  }

  function test_setWhitelist_revert_OwnableUnauthorizedAccount() public {
    vm.startPrank(initialMintRecipient_);
    vm.expectRevert(
      abi.encodeWithSelector(
        OwnableUnauthorizedAccount.selector,
        initialMintRecipient_
      )
    );
    simpleContract_.setWhitelist(initialMintRecipient_, true);
    vm.stopPrank();
  }

  function test_setWhitelist_success() public {
    vm.startPrank(initialOwner_);
    assertEq(simpleContract_.whitelist(poolAddr), false);
    simpleContract_.setWhitelist(poolAddr, true);
    assertEq(simpleContract_.whitelist(poolAddr), true);
    vm.stopPrank();
  }
}
