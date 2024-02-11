// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/examples/ExampleERC404.sol";
import "../src/mocks/MinimalERC404.sol";
import {IERC404} from "../src/interfaces/IERC404.sol";
import "../src/ERC404.sol";

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
        // ExampleERC404.sol
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

    function test_tokenTransfer(uint8 nftToTransfer, address randomAddress) public {
        vm.assume(nftToTransfer <= 100);
        vm.assume(randomAddress != address(0));

        // Transfer some tokens to a non-whitelisted wallet to generate the NFTs.
        vm.prank(initialMintRecipient_);
        simpleContract_.transfer(randomAddress, nftToTransfer * units_);

        // Returns the correct total supply
        assertEq(simpleContract_.erc721TotalSupply(), nftToTransfer);
        assertEq(simpleContract_.totalSupply(), maxTotalSupplyNft_ * units_);
        assertEq(simpleContract_.erc20TotalSupply(), maxTotalSupplyNft_ * units_);

        // Reverts if the token ID is 0
        vm.expectRevert(IERC404.NotFound.selector);
        simpleContract_.ownerOf(0);

        // Reverts if the token ID is `nftToTransfer + 1` (does not exist)
        vm.expectRevert(IERC404.NotFound.selector);
        simpleContract_.ownerOf(nftToTransfer + 1);

        for (uint8 i = 1; i <= nftToTransfer; i++) {
            assertEq(simpleContract_.ownerOf(i), randomAddress);
        }
    }
}

contract Erc404MintingStorageAndRetrievalTest is Test {
    MinimalERC404 public minimalContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 units_ = 10 ** decimals_;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 maxTotalSupplyCoin_ = maxTotalSupplyNft_ * units_;

    address initialOwner_ = address(0x1);

    event ERC721Transfer(address indexed from, address indexed to, uint256 indexed id);
    event ERC20Transfer(address indexed from, address indexed to, uint256 amount);

    function setUp() public {
        minimalContract_ = new MinimalERC404(name_, symbol_, decimals_, initialOwner_);
    }

    function test_initializeMinimal() public {
        assertEq(minimalContract_.name(), name_);
        assertEq(minimalContract_.symbol(), symbol_);
        assertEq(minimalContract_.decimals(), decimals_);
        assertEq(minimalContract_.owner(), initialOwner_);
    }

    function test_mintFullSupply_20_721(address recipient) public {
        vm.assume(recipient != address(0));

        // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(recipient, maxTotalSupplyCoin_, true);

        // Expect the total supply to be equal to the max total supply
        assertEq(minimalContract_.totalSupply(), maxTotalSupplyCoin_);
        assertEq(minimalContract_.erc20TotalSupply(), maxTotalSupplyCoin_);

        // Expect the minted count to be equal to the max total supply
        assertEq(minimalContract_.erc721TotalSupply(), maxTotalSupplyNft_);
    }

    function test_mintFullSupply_20(address recipient) public {
        vm.assume(recipient != address(0));

        // Owner mints the full supply of ERC20 tokens only
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(recipient, maxTotalSupplyCoin_, false);

        // Expect the total supply to be equal to the max total supply
        assertEq(minimalContract_.totalSupply(), maxTotalSupplyCoin_);
        assertEq(minimalContract_.erc20TotalSupply(), maxTotalSupplyCoin_);

        // Expect the minted count to be equal to 0
        assertEq(minimalContract_.erc721TotalSupply(), 0);
    }

    function test_erc721Storage_mintFrom0(uint8 nftQty, address recipient) public {
        vm.assume(nftQty < maxTotalSupplyNft_);
        vm.assume(recipient != address(0) && recipient != initialOwner_ && recipient != address(minimalContract_));

        // Total supply should be 0
        assertEq(minimalContract_.erc721TotalSupply(), 0);

        // Expect the contract's bank to be empty
        assertEq(minimalContract_.balanceOf(address(minimalContract_)), 0);
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 0);

        uint256 value = nftQty * units_;

        // mint at the bottom, setup expected events first

        // expect 1 erc20 transfer event
        // Check for ERC20Transfer mint events (from 0x0 to the recipient)
        vm.expectEmit(false, false, false, true);
        emit ERC20Transfer(address(0), recipient, value);

        // expect multiple erc721 transfers
        for (uint8 i = 1; i <= nftQty; i++) {
            // Check for ERC721Transfer mint events (from 0x0 to the recipient)
            vm.expectEmit(true, true, true, true);
            emit ERC721Transfer(address(0), recipient, i);
        }

        // mint as owner
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(recipient, value, true);

        // nft supply and balance
        assertEq(minimalContract_.erc721TotalSupply(), nftQty);
        assertEq(minimalContract_.erc721BalanceOf(recipient), nftQty);

        // coin supply and balance
        assertEq(minimalContract_.erc20TotalSupply(), value);
        assertEq(minimalContract_.erc20BalanceOf(recipient), value);

        assertEq(minimalContract_.totalSupply(), value);
        assertEq(minimalContract_.balanceOf(recipient), value);
    }

    function test_erc721Storage_storeInBankOnBurn(uint8 nftQty, address recipient1, address recipient2) public {
        // TODO - handle recipient1 = recipient2
        vm.assume(recipient1 != recipient2);

        vm.assume(nftQty > 0 && nftQty < maxTotalSupplyNft_);
        vm.assume(recipient1 != address(0) && recipient1 != initialOwner_ && recipient1 != address(minimalContract_));
        vm.assume(recipient2 != address(0) && recipient2 != initialOwner_ && recipient2 != address(minimalContract_));
        vm.assume(!minimalContract_.whitelist(recipient1) && !minimalContract_.whitelist(recipient2));

        // Total supply should be 0
        assertEq(minimalContract_.erc721TotalSupply(), 0);

        // Expect the contract's bank to be empty
        assertEq(minimalContract_.balanceOf(address(minimalContract_)), 0);
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 0);

        uint256 value = nftQty * units_;

        // mint as owner
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(recipient1, value, true);

        uint256 fractionalValueToTransferErc20 = units_ / 10;

        // setup expected events
        // ERC20 transfer
        vm.expectEmit(false, false, false, false);
        emit ERC20Transfer(recipient1, recipient2, fractionalValueToTransferErc20);

        // // ERC721 burn (last token id = nftQty)
        vm.expectEmit(false, false, false, false);
        emit ERC721Transfer(recipient1, address(0), nftQty);

        vm.prank(recipient1);
        minimalContract_.transfer(recipient2, fractionalValueToTransferErc20);

        // erc721 total supply stays the same
        assertEq(minimalContract_.erc721TotalSupply(), nftQty);

        // owner of NFT id nftQty should be 0x0
        vm.expectRevert(IERC404.NotFound.selector);
        minimalContract_.ownerOf(nftQty);

        // sender nft balance is nftQty - 1
        assertEq(minimalContract_.erc721BalanceOf(recipient1), nftQty - 1);

        // contract balance = 0
        // contract bank = 1 nft
        assertEq(minimalContract_.balanceOf(address(minimalContract_)), 0);
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 1);
    }

    function test_erc721Storage_retrieveFromBank(uint8 nftQty, address recipient1, address recipient2) public {
        // TODO - handle recipient1 = recipient2
        vm.assume(recipient1 != recipient2);

        vm.assume(nftQty > 0 && nftQty < maxTotalSupplyNft_);
        vm.assume(recipient1 != address(0) && recipient1 != initialOwner_ && recipient1 != address(minimalContract_));
        vm.assume(recipient2 != address(0) && recipient2 != initialOwner_ && recipient2 != address(minimalContract_));
        vm.assume(!minimalContract_.whitelist(recipient1) && !minimalContract_.whitelist(recipient2));

        uint256 value = nftQty * units_;

        // mint as owner
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(recipient1, value, true);

        uint256 fractionalValueToTransferErc20 = units_ / 10;
        vm.prank(recipient1);
        minimalContract_.transfer(recipient2, fractionalValueToTransferErc20);

        assertEq(minimalContract_.balanceOf(address(minimalContract_)), 0);
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 1);

        // reconstitute
        // expected events
        vm.expectEmit(false, false, false, false);
        emit ERC20Transfer(recipient2, recipient1, fractionalValueToTransferErc20);

        vm.expectEmit(false, false, false, false);
        emit ERC721Transfer(address(0), recipient1, nftQty);

        // tx
        vm.prank(recipient2);
        minimalContract_.transfer(recipient1, fractionalValueToTransferErc20);

        // Original sender's ERC20 balance should be nftQty * units
        // The owner of NFT `nftQty` should be the original sender's address
        assertEq(minimalContract_.erc20BalanceOf(recipient1), nftQty * units_);
        assertEq(minimalContract_.ownerOf(nftQty), recipient1);

        // The sender's NFT balance should be 10
        // The contract's NFT balance should be 0
        // The contract's bank should contain 0 NFTs
        assertEq(minimalContract_.erc721BalanceOf(recipient1), nftQty);
        assertEq(minimalContract_.balanceOf(address(minimalContract_)), 0);
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 0);
    }
}

contract ERC404TransferLogicTest is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = address(0x2);

    // alice is initial sender for all this test;
    address alice = address(0xa);
    address bob = address(0xb);

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);

        // Add the owner to the whitelist
        vm.prank(initialOwner_);
        simpleContract_.setWhitelist(initialOwner_, true);

        vm.prank(initialMintRecipient_);
        simpleContract_.transfer(alice, maxTotalSupplyNft_ * units_);
    }
    //////// Fractional transfers (moving less than 1 full token) that trigger ERC721 transfers

    function test_erc20TransferTriggering721Transfer_fractional_receiverGain() public {
        // Bob starts with 0.9 tokens
        uint256 bobInitialBalance = units_ * 9 / 10;
        vm.prank(alice);
        simpleContract_.transfer(bob, bobInitialBalance);

        uint256 aliceInitialBalance = simpleContract_.balanceOf(alice);
        uint256 aliceInitialNftBalance = (simpleContract_.erc721BalanceOf(alice));

        // Ensure that the receiver has 0.9 tokens and 0 NFTs.
        assertEq(simpleContract_.balanceOf(bob), bobInitialBalance);
        assertEq(simpleContract_.erc20BalanceOf(bob), bobInitialBalance);
        assertEq(simpleContract_.erc721BalanceOf(bob), 0);

        uint256 fractionalValueToTransferErc20 = units_ / 10;
        vm.prank(alice);

        simpleContract_.transfer(bob, fractionalValueToTransferErc20);

        // Verify ERC20 balances after transfer
        assertEq(simpleContract_.balanceOf(alice), aliceInitialBalance - fractionalValueToTransferErc20);
        assertEq(simpleContract_.balanceOf(bob), bobInitialBalance + fractionalValueToTransferErc20);

        // Verify ERC721 balances after transfer
        // Assuming the receiver should have gained 1 NFT due to the transfer completing a whole token
        assertEq(simpleContract_.erc721BalanceOf(alice), aliceInitialNftBalance);
        assertEq(simpleContract_.erc721BalanceOf(bob), 1);
    }

    function test_erc20TransferTriggering721Transfer_fractional_senderLose() public {
        uint256 aliceStartingBalanceErc20 = simpleContract_.balanceOf(alice);
        uint256 aliceStartingBalanceErc721 = simpleContract_.erc721BalanceOf(alice);

        uint256 bobStartingBalanceErc20 = simpleContract_.balanceOf(bob);
        uint256 bobStartingBalanceErc721 = simpleContract_.erc721BalanceOf(bob);

        assertEq(aliceStartingBalanceErc20, maxTotalSupplyNft_ * units_);
        // Sender starts with 100 tokens and sends 0.1, resulting in the loss of 1 NFT but no NFT transfer to the receiver.
        uint256 initialFractionalAmount = units_ / 10;
        vm.prank(alice);
        simpleContract_.transfer(bob, initialFractionalAmount);

        // Post-transfer balances
        uint256 aliceAfterBalanceErc20 = simpleContract_.balanceOf(alice);
        uint256 aliceAfterBalanceErc721 = simpleContract_.erc721BalanceOf(alice);

        uint256 bobAfterBalanceErc20 = simpleContract_.balanceOf(bob);
        uint256 bobAfterBalanceErc721 = simpleContract_.erc721BalanceOf(bob);

        assertEq(aliceAfterBalanceErc20, aliceStartingBalanceErc20 - initialFractionalAmount);
        assertEq(bobAfterBalanceErc20, bobStartingBalanceErc20 + initialFractionalAmount);

        // Verify ERC721 balances after transfer
        // Assuming the sender should lose 1 NFT due to the transfer causing a loss of a whole token.
        // Sender loses an NFT
        assertEq(aliceAfterBalanceErc721, aliceStartingBalanceErc721 - 1);
        // No NFT gain for the receiver
        assertEq(bobAfterBalanceErc721, bobStartingBalanceErc721);
        // Contract gains an NFT (it's stored in the contract in this scenario).
        // TODO - Verify this with the contract's balance.
    }

    //////// Moving one or more full tokens
    function test_erc20TransferTriggering721Transfer_whole_noFractionalImpact() public {
        // Transfers whole tokens without fractional impact correctly
        uint256 aliceStartingBalanceErc20 = simpleContract_.balanceOf(alice);
        uint256 aliceStartingBalanceErc721 = simpleContract_.erc721BalanceOf(alice);

        uint256 bobStartingBalanceErc20 = simpleContract_.balanceOf(bob);
        uint256 bobStartingBalanceErc721 = simpleContract_.erc721BalanceOf(bob);

        // Transfer 2 whole tokens
        uint256 erc721TokensToTransfer = 2;
        uint256 valueToTransferERC20 = erc721TokensToTransfer * units_;

        vm.prank(alice);
        simpleContract_.transfer(bob, valueToTransferERC20);

        // Post-transfer balances
        uint256 aliceAfterBalanceErc20 = simpleContract_.balanceOf(alice);
        uint256 aliceAfterBalanceErc721 = simpleContract_.erc721BalanceOf(alice);

        uint256 bobAfterBalanceErc20 = simpleContract_.balanceOf(bob);
        uint256 bobAfterBalanceErc721 = simpleContract_.erc721BalanceOf(bob);

        // Verify ERC20 balances after transfer
        assertEq(aliceAfterBalanceErc20, aliceStartingBalanceErc20 - valueToTransferERC20);
        assertEq(bobAfterBalanceErc20, bobStartingBalanceErc20 + valueToTransferERC20);

        // Verify ERC721 balances after transfer - Assuming 2 NFTs should have been transferred
        assertEq(aliceAfterBalanceErc721, aliceStartingBalanceErc721 - erc721TokensToTransfer);
        assertEq(bobAfterBalanceErc721, bobStartingBalanceErc721 + erc721TokensToTransfer);
    }

    function test_erc20TransferTriggering721Transfer_allCasesAtOnce() public {
        // Handles the case of sending 3.2 tokens where the sender started out with 99.1 tokens and the receiver started with 0.9 tokens
        // This test demonstrates all 3 cases in one scenario:
        // - The sender loses a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        // - The receiver gains a whole new token (0.9 + 3.2 (3 whole, 0.2 fractional) = 4.1)
        // - The sender transfers 3 whole tokens to the receiver (99.1 - 3.2 (3 whole, 0.2 fractional) = 95.9)

        uint256 bobStartingBalanceErc20 = units_ * 9 / 10;

        vm.prank(alice);
        simpleContract_.transfer(bob, bobStartingBalanceErc20);

        uint256 aliceStartingBalanceErc20 = simpleContract_.balanceOf(alice);
        uint256 aliceStartingBalanceErc721 = simpleContract_.erc721BalanceOf(alice);
        uint256 bobStartingBalanceErc721 = simpleContract_.erc721BalanceOf(bob);

        assertEq(bobStartingBalanceErc721, 0);

        // Transfer an amount that results in:
        // - the receiver gaining a whole new token (0.9 + 0.2 + 3)
        // - the sender losing a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        uint256 fractionalValueToTransferERC20 = units_ * 32 / 10;
        vm.prank(alice);
        simpleContract_.transfer(bob, fractionalValueToTransferERC20);

        // post transfer
        // ERC20
        uint256 aliceAfterBalanceErc20 = simpleContract_.balanceOf(alice);
        uint256 bobAfterBalanceErc20 = simpleContract_.balanceOf(bob);
        assertEq(aliceAfterBalanceErc20, aliceStartingBalanceErc20 - fractionalValueToTransferERC20);
        assertEq(bobAfterBalanceErc20, bobStartingBalanceErc20 + fractionalValueToTransferERC20);

        // ERC721
        uint256 aliceAfterBalanceErc721 = simpleContract_.erc721BalanceOf(alice);
        uint256 bobAfterBalanceErc721 = simpleContract_.erc721BalanceOf(bob);

        assertEq(aliceAfterBalanceErc721, aliceStartingBalanceErc721 - 4);
        assertEq(bobAfterBalanceErc721, bobStartingBalanceErc721 + 4);
    }
}

contract ERC404TransferFromTest is Test {
    ExampleERC404 public simpleContract_;
    MinimalERC404 public minimalContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;
    uint256 maxTotalSupplyCoin_ = maxTotalSupplyNft_ * units_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = initialOwner_;

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
        minimalContract_ = new MinimalERC404(name_, symbol_, decimals_, initialOwner_);
    }

    function test_revert_transferFrom_fromZero() public {
        // Doesn't allow anyone to transfer from 0x0
        vm.expectRevert(IERC404.InvalidSender.selector);
        vm.prank(initialOwner_);
        simpleContract_.transferFrom(address(0), initialMintRecipient_, 1);
    }

    function test_revert_transferFrom_toZero() public {
        // Doesn't allow anyone to transferFrom to 0x0
        vm.expectRevert(IERC404.InvalidRecipient.selector);
        vm.prank(initialOwner_);
        simpleContract_.transferFrom(initialMintRecipient_, address(0), 1);
    }

    function test_revert_transferFrom_ToAndFromZero() public {
        // Doesn't allow anyone to transfer from 0x0 to 0x0
        vm.expectRevert(IERC404.InvalidSender.selector);
        vm.prank(initialOwner_);
        simpleContract_.transferFrom(address(0), address(0), 1);
    }

    function test_mintFullSupply_20_721(address recipient) public {
        vm.assume(recipient != address(0));

        // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(recipient, maxTotalSupplyCoin_, true);

        // Expect the total supply to be equal to the max total supply
        assertEq(minimalContract_.totalSupply(), maxTotalSupplyCoin_);
        assertEq(minimalContract_.erc20TotalSupply(), maxTotalSupplyCoin_);

        // Expect the minted count to be equal to the max total supply
        assertEq(minimalContract_.erc721TotalSupply(), maxTotalSupplyNft_);
    }

    // Context: Operator owns the token to be moved
    function test_revert_transferNotOwnedByAlice() public {
        // mint all fixture
        test_mintFullSupply_20_721(initialOwner_);

        // Reverts when attempting to transfer a token that 'from' does not own
        address alice = address(0xa);
        address bob = address(0xb);

        uint256 tokenId = 1;
        address wrongFrom = alice;
        address to = bob;

        // Confirm that the target token exists, and that it has a non-0x0 owner.
        assertNotEq(minimalContract_.ownerOf(tokenId), address(0));

        // Confirm that the operator owns the token.
        assertEq(minimalContract_.ownerOf(tokenId), initialOwner_);

        // Confirm that the owner of the token is not the wrongFrom address.
        assertNotEq(minimalContract_.ownerOf(tokenId), wrongFrom);

        // Confirm that to address does not own the token either.
        assertNotEq(minimalContract_.ownerOf(tokenId), to);

        // Attempt to send 1 ERC-721.
        vm.expectRevert(IERC404.Unauthorized.selector);
        vm.prank(initialOwner_);
        minimalContract_.transferFrom(wrongFrom, to, tokenId);
    }

    function test_transferOwnedByOperator() public {
        // mint all fixture
        test_mintFullSupply_20_721(initialOwner_);

        uint256 tokenId = 1;
        address to = address(0xa);

        // Confirm that the target token exists, and that it has a non-0x0 owner.
        assertNotEq(minimalContract_.ownerOf(tokenId), address(0));

        // Confirm that the operator owns the token.
        assertEq(minimalContract_.ownerOf(tokenId), initialOwner_);

        // Confirm that to address does not own the token either.
        assertNotEq(minimalContract_.ownerOf(tokenId), to);

        // Attempt to send 1 ERC-721.
        vm.prank(initialOwner_);
        minimalContract_.transferFrom(initialOwner_, to, tokenId);
    }

    // Context: Operator does not own the token to be moved
    function test_revert_transferNotOwnedByOperator() public {
        // mint all fixture
        test_mintFullSupply_20_721(initialOwner_);

        address operator = address(0xa);
        address wrongFrom = address(0xb);
        address to = address(0xc);
        uint256 tokenId = 1;

        // Confirm that the target token exists, and that it has a non-0x0 owner.
        assertNotEq(minimalContract_.ownerOf(tokenId), address(0));

        // Confirm that the initial minter owns the token.
        assertEq(minimalContract_.ownerOf(tokenId), initialOwner_);

        // Confirm that the owner of the token is not the wrongFrom address.
        assertNotEq(minimalContract_.ownerOf(tokenId), operator);

        // Confirm that the owner of the token is not the wrongFrom address.
        assertNotEq(minimalContract_.ownerOf(tokenId), wrongFrom);

        // Confirm that to address does not own the token either.
        assertNotEq(minimalContract_.ownerOf(tokenId), to);

        // Attempt to send 1 ERC-721 as operator
        vm.expectRevert(IERC404.Unauthorized.selector);
        vm.prank(operator);
        minimalContract_.transferFrom(wrongFrom, to, tokenId);
    }

    // TODO: Reverts when operator has not been approved to move 'from''s token
    // TODO: Allows an approved operator to transfer a token owned by 'from'
}

contract ERC404TransferTest is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = initialOwner_;

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    function test_revert_transfer_toZero() public {
        // Doesn't allow anyone to transfer to 0x0

        // Attempt to send 1 ERC-721 to 0x0.
        vm.expectRevert(IERC404.InvalidRecipient.selector);
        vm.prank(initialOwner_);
        simpleContract_.transfer(address(0), 1);

        // Attempt to send 1 full token worth of ERC-20s to 0x0
        vm.expectRevert(IERC404.InvalidRecipient.selector);
        vm.prank(initialOwner_);
        simpleContract_.transfer(address(0), units_);
    }

    // TODO(transfer) - more tests needed here, including testing that approvals work.
}

contract Erc404SetWhitelistTest is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = initialOwner_;

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    function test_setWhitelist_ownerAddAndRemove(address a) public {
        vm.assume(a != initialMintRecipient_);
        vm.assume(!simpleContract_.whitelist(a));
        assertFalse(simpleContract_.whitelist(a));

        // Add a random address to the whitelist
        vm.prank(initialOwner_);
        simpleContract_.setWhitelist(a, true);

        assertTrue(simpleContract_.whitelist(a));

        // Remove the random address from the whitelist
        vm.prank(initialOwner_);
        simpleContract_.setWhitelist(a, false);

        assertFalse(simpleContract_.whitelist(a));
    }

    function test_revert_setWhitelist_removeAddressWithErc20Balance(address a) public {
        // An address cannot be removed from the whitelist while it has an ERC-20 balance >= 1 full token.

        vm.assume(a != initialMintRecipient_);
        vm.assume(a != initialOwner_);
        vm.assume(a != address(0));
        vm.assume(!simpleContract_.whitelist(a));
        assertFalse(simpleContract_.whitelist(a));

        // Transfer 1 full NFT worth of tokens to that address.
        vm.prank(initialMintRecipient_);
        simpleContract_.transfer(a, units_);

        assertEq(simpleContract_.erc721BalanceOf(a), 1);

        // Add a random address to the whitelist
        vm.prank(initialOwner_);
        simpleContract_.setWhitelist(a, true);

        assertTrue(simpleContract_.whitelist(a));

        // Attempt to remove the random address from the whitelist
        vm.expectRevert(IERC404.CannotRemoveFromWhitelist.selector);
        vm.prank(initialOwner_);
        simpleContract_.setWhitelist(a, false);

        assertTrue(simpleContract_.whitelist(a));
    }
}

contract Erc404Erc721BalanceOfTest is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = initialOwner_;

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    function test_0_9_balance() public {
        // The address has 0.9 ERC-20 balance
        // Returns the correct balance (0 ERC-721)
        address alice = address(0xa);
        uint256 transferAmount = units_ * 9 / 10;

        vm.prank(initialOwner_);
        simpleContract_.transfer(alice, transferAmount);

        assertEq(simpleContract_.erc20BalanceOf(alice), transferAmount);
        assertEq(simpleContract_.erc721BalanceOf(alice), 0);
    }

    function test_exactly1Balance() public {
        // The address has exactly 1.0 ERC-20 balance
        // Returns the correct balance (1 ERC-721)
        address alice = address(0xa);
        uint256 transferAmount = units_;

        vm.prank(initialOwner_);
        simpleContract_.transfer(alice, transferAmount);

        assertEq(simpleContract_.erc20BalanceOf(alice), transferAmount);
        assertEq(simpleContract_.erc721BalanceOf(alice), 1);
    }

    function test_1_1_balance() public {
        // The address has 1.1 ERC-20 balance
        // Returns the correct balance (1 ERC-721)
        address alice = address(0xa);
        uint256 transferAmount = units_ * 11 / 10;

        vm.prank(initialOwner_);
        simpleContract_.transfer(alice, transferAmount);

        assertEq(simpleContract_.erc20BalanceOf(alice), transferAmount);
        assertEq(simpleContract_.erc721BalanceOf(alice), 1);
    }
}

contract Erc404Erc20BalanceOfTest is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = initialOwner_;

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    function test_balanceOf() public {
        address alice = address(0xa);
        uint256 transferAmount = units_ * 9 / 10;

        vm.prank(initialOwner_);
        simpleContract_.transfer(alice, transferAmount);

        assertEq(simpleContract_.erc20BalanceOf(alice), transferAmount);

        vm.prank(initialOwner_);
        simpleContract_.transfer(alice, transferAmount);

        assertEq(simpleContract_.erc20BalanceOf(alice), transferAmount * 2);
    }
}

contract Erc404SetApprovalForAllTest is Test {
    ExampleERC404 public simpleContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 maxTotalSupplyNft_ = 100;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);
    address initialMintRecipient_ = initialOwner_;

    event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);

    function setUp() public {
        simpleContract_ =
            new ExampleERC404(name_, symbol_, decimals_, maxTotalSupplyNft_, initialOwner_, initialMintRecipient_);
    }

    // Granting approval to a valid address besides themselves
    function test_approvalOperator_setApprovalForAll(address intendedOperator) public {
        vm.assume(intendedOperator != address(0));
        // Allows a user to set an operator who has approval for all their ERC-721 tokens
        assertEq(simpleContract_.isApprovedForAll(initialOwner_, intendedOperator), false);

        // Approve for all
        // Expected Events
        vm.expectEmit(false, false, false, false);
        emit ApprovalForAll(initialOwner_, intendedOperator, true);
        // Tx
        vm.prank(initialOwner_);
        simpleContract_.setApprovalForAll(intendedOperator, true);
    }

    function test_approvalOperator_removeOperatorApprovalForAll(address intendedOperator) public {
        test_approvalOperator_setApprovalForAll(intendedOperator);
        vm.prank(initialOwner_);
        simpleContract_.setApprovalForAll(intendedOperator, false);

        assertEq(simpleContract_.isApprovedForAll(initialOwner_, intendedOperator), false);
    }

    // Granting approval to themselves
    function test_approvalSelf_all721() public {
        // Allows a user to set themselves as an operator who has approval for all their ERC-721 tokens
        assertFalse(simpleContract_.isApprovedForAll(initialOwner_, initialOwner_));
        vm.prank(initialOwner_);
        simpleContract_.setApprovalForAll(initialOwner_, true);
        assertTrue(simpleContract_.isApprovedForAll(initialOwner_, initialOwner_));
    }

    function test_approvalSelf_removeApproval() public {
        // Allows a user to remove their own approval for all
        test_approvalSelf_all721();
        vm.prank(initialOwner_);
        simpleContract_.setApprovalForAll(initialOwner_, false);
        assertFalse(simpleContract_.isApprovedForAll(initialOwner_, initialOwner_));
    }

    // Granting approval to 0x0
    function test_reverts_approvalZero() public {
        // Reverts if the user attempts to grant or revoke approval for all to 0x0
        vm.expectRevert(IERC404.InvalidOperator.selector);
        vm.prank(initialOwner_);
        simpleContract_.setApprovalForAll(address(0), true);

        vm.expectRevert(IERC404.InvalidOperator.selector);
        vm.prank(initialOwner_);
        simpleContract_.setApprovalForAll(address(0), false);
    }
}

contract Erc404RetrieveOrMint721Test is Test {
    MinimalERC404 public minimalContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    uint256 units_ = 10 ** decimals_;

    address initialOwner_ = address(0x1);

    function setUp() public {
        minimalContract_ = new MinimalERC404(name_, symbol_, decimals_, initialOwner_);
    }

    // When the contract has no tokens in the queue

    // - Contract ERC-721 balance is 0

    function test_balanceZero_mintFull20And721() public {
        // Mints a new full ERC-20 token + corresponding ERC-721 token
        assertEq(minimalContract_.balanceOf(address(minimalContract_)), 0);
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 0);
        assertEq(minimalContract_.erc721TotalSupply(), 0);

        vm.prank(initialOwner_);
        minimalContract_.mintERC20(initialOwner_, units_, true);

        assertEq(minimalContract_.erc721TotalSupply(), 1);
    }

    // - Contract ERC-721 balance is > 0
    function test_balanceGtZero_mintFull20And721() public {
        // Mints a new full ERC-20 token + corresponding ERC-721 token
        test_balanceZero_mintFull20And721();

        // Transfer the factional token to the contract
        vm.prank(initialOwner_);
        minimalContract_.transferFrom(initialOwner_, address(minimalContract_), 1);

        assertEq(minimalContract_.erc721BalanceOf(address(minimalContract_)), 1);

        // Expect the contract to have 0 ERC-721 token in the queue
        assertEq(minimalContract_.erc721TokensBankedInQueue(), 0);

        // Expect the contract to own token 1
        assertEq(minimalContract_.ownerOf(1), address(minimalContract_));

        // Mint a new full ERC-20 token + corresponding ERC-721 token
        vm.prank(initialOwner_);
        minimalContract_.mintERC20(initialOwner_, units_, true);

        assertEq(minimalContract_.erc721TotalSupply(), 2);

        // Expect the contract to still own token 1
        assertEq(minimalContract_.ownerOf(1), address(minimalContract_));
        // Expect the mint recipient to have have a balance of 1 ERC-721 token        assertEq(minimalContract_.erc721BalanceOf(address(minimalContract_)), 1);
        assertEq(minimalContract_.erc721BalanceOf(address(initialOwner_)), 1);

        // Expect the contract to have an ERC-20 balance of 1 full token
        assertEq(minimalContract_.erc20BalanceOf(address(minimalContract_)), units_);

        // Expect the mint recipient to be the owner of token 2
        assertEq(minimalContract_.ownerOf(2), address(initialOwner_));
    }
}

contract Erc404E2ETest is Test {
    MinimalERC404 public minimalContract_;

    string name_ = "Example";
    string symbol_ = "EXM";
    uint8 decimals_ = 18;
    // uint256 units_ = 10 ** decimals_;
    // uint256 maxTotalSupplyNft_ = 100;
    // uint256 maxTotalSupplyCoin_ = maxTotalSupplyNft_ * units_;

    address initialOwner_ = address(0x1);

    // event ERC721Transfer(address indexed from, address indexed to, uint256 indexed id);
    // event ERC20Transfer(address indexed from, address indexed to, uint256 amount);

    function setUp() public {
        minimalContract_ = new MinimalERC404(name_, symbol_, decimals_, initialOwner_);
    }

    function test_mintFull_transfer20_transfer721_bankRetrieve_setRemoveWhitelist() public {}
}

contract Erc404SetApprovalTest is Test {}

contract Erc404PermitTest is Test {}
