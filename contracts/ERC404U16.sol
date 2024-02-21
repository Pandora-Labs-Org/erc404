//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC404} from "./interfaces/IERC404.sol";
import {PackedDoubleEndedQueue} from "./lib/PackedDoubleEndedQueue.sol";
import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";

/// @dev This is an optimized ERC404 implementation designed to support smaller collections,
///      with id's up to a maximum of 65535.
abstract contract ERC404U16 is IERC404 {
  using PackedDoubleEndedQueue for PackedDoubleEndedQueue.Uint16Deque;

  /// @dev The queue of ERC-721 tokens stored in the contract.
  PackedDoubleEndedQueue.Uint16Deque private _storedERC721Ids;

  /// @dev Token name
  string public name;

  /// @dev Token symbol
  string public symbol;

  /// @dev Decimals for ERC-20 representation
  uint8 public immutable decimals;

  /// @dev Units for ERC-20 representation
  uint256 public immutable units;

  /// @dev Total supply in ERC-20 representation
  uint256 public totalSupply;

  /// @dev Current mint counter which also represents the highest
  ///      minted id, monotonically increasing to ensure accurate ownership
  uint256 public minted;

  /// @dev Initial chain id for EIP-2612 support
  uint256 internal immutable _INITIAL_CHAIN_ID;

  /// @dev Initial domain separator for EIP-2612 support
  bytes32 internal immutable _INITIAL_DOMAIN_SEPARATOR;

  /// @dev Balance of user in ERC-20 representation
  mapping(address => uint256) public balanceOf;

  /// @dev Allowance of user in ERC-20 representation
  mapping(address => mapping(address => uint256)) public allowance;

  /// @dev Approval in ERC-721 representaion
  mapping(uint256 => address) public getApproved;

  /// @dev Approval for all in ERC-721 representation
  mapping(address => mapping(address => bool)) public isApprovedForAll;

  /// @dev Packed representation of ownerOf and owned indices
  mapping(uint256 => uint256) internal _ownedData;

  /// @dev Array of owned ids in ERC-721 representation
  mapping(address => uint16[]) internal _owned;

  /// @dev Addresses that are exempt from ERC-721 transfer, typically for gas savings (pairs, routers, etc)
  mapping(address => bool) internal _erc721TransferExempt;

  /// @dev EIP-2612 nonces
  mapping(address => uint256) public nonces;

  /// @dev Address bitmask for packed ownership data
  uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;

  /// @dev Owned index bitmask for packed ownership data
  uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

  /// @dev Constant for token id encoding
  uint256 public constant ID_ENCODING_PREFIX = 1 << 255;

  constructor(string memory name_, string memory symbol_, uint8 decimals_) {
    name = name_;
    symbol = symbol_;

    if (decimals_ < 18) {
      revert DecimalsTooLow();
    }

    decimals = decimals_;
    units = 10 ** decimals;

    // EIP-2612 initialization
    _INITIAL_CHAIN_ID = block.chainid;
    _INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
  }

  /// @notice Function to find owner of a given ERC-721 token
  function ownerOf(
    uint256 id_
  ) public view virtual returns (address erc721Owner) {
    erc721Owner = _getOwnerOf(id_);

    if (!_isValidTokenId(id_)) {
      revert InvalidTokenId();
    }

    if (erc721Owner == address(0)) {
      revert NotFound();
    }
  }

  function owned(
    address owner_
  ) public view virtual returns (uint256[] memory) {
    uint256[] memory ownedAsU256 = new uint256[](_owned[owner_].length);

    for (uint256 i = 0; i < _owned[owner_].length; ) {
      ownedAsU256[i] = ID_ENCODING_PREFIX + _owned[owner_][i];

      unchecked {
        ++i;
      }
    }

    return ownedAsU256;
  }

  function erc721BalanceOf(
    address owner_
  ) public view virtual returns (uint256) {
    return _owned[owner_].length;
  }

  function erc20BalanceOf(
    address owner_
  ) public view virtual returns (uint256) {
    return balanceOf[owner_];
  }

  function erc20TotalSupply() public view virtual returns (uint256) {
    return totalSupply;
  }

  function erc721TotalSupply() public view virtual returns (uint256) {
    return minted;
  }

  function getERC721QueueLength() public view virtual returns (uint256) {
    return _storedERC721Ids.length();
  }

  function getERC721TokensInQueue(
    uint256 start_,
    uint256 count_
  ) public view virtual returns (uint256[] memory) {
    uint256[] memory tokensInQueue = new uint256[](count_);

    for (uint256 i = start_; i < start_ + count_; ) {
      tokensInQueue[i - start_] = ID_ENCODING_PREFIX + _storedERC721Ids.at(i);

      unchecked {
        ++i;
      }
    }

    return tokensInQueue;
  }

  /// @notice tokenURI must be implemented by child contract
  function tokenURI(uint256 id_) public view virtual returns (string memory);

  /// @notice Function for token approvals
  /// @dev This function assumes the operator is attempting to approve an ERC-721
  ///      if valueOrId is less than the minted count. Unlike setApprovalForAll,
  ///      spender_ must be allowed to be 0x0 so that approval can be revoked.
  function approve(
    address spender_,
    uint256 valueOrId_
  ) public virtual returns (bool) {
    // The ERC-721 tokens are 1-indexed, so 0 is not a valid id and indicates that
    // operator is attempting to set the ERC-20 allowance to 0.
    if (_isValidTokenId(valueOrId_)) {
      erc721Approve(spender_, valueOrId_);
    } else {
      return erc20Approve(spender_, valueOrId_);
    }

    return true;
  }

  function erc721Approve(address spender_, uint256 id_) public virtual {
    // Intention is to approve as ERC-721 token (id).
    address erc721Owner = _getOwnerOf(id_);

    if (
      msg.sender != erc721Owner && !isApprovedForAll[erc721Owner][msg.sender]
    ) {
      revert Unauthorized();
    }

    getApproved[id_] = spender_;

    emit ERC721Events.Approval(erc721Owner, spender_, id_);
  }

  /// @dev Providing type(uint256).max for approval value results in an
  ///      unlimited approval that is not deducted from on transfers.
  function erc20Approve(
    address spender_,
    uint256 value_
  ) public virtual returns (bool) {
    // Prevent granting 0x0 an ERC-20 allowance.
    if (spender_ == address(0)) {
      revert InvalidSpender();
    }

    // Intention is to approve as ERC-20 token (value).
    allowance[msg.sender][spender_] = value_;

    emit ERC20Events.Approval(msg.sender, spender_, value_);

    return true;
  }

  /// @notice Function for ERC-721 approvals
  function setApprovalForAll(address operator_, bool approved_) public virtual {
    // Prevent approvals to 0x0.
    if (operator_ == address(0)) {
      revert InvalidOperator();
    }
    isApprovedForAll[msg.sender][operator_] = approved_;
    emit ERC721Events.ApprovalForAll(msg.sender, operator_, approved_);
  }

  /// @notice Function for mixed transfers from an operator that may be different than 'from'.
  /// @dev This function assumes the operator is attempting to transfer an ERC-721
  ///      if valueOrId is less than or equal to current max id.
  function transferFrom(
    address from_,
    address to_,
    uint256 valueOrId_
  ) public virtual returns (bool) {
    if (_isValidTokenId(valueOrId_)) {
      erc721TransferFrom(from_, to_, valueOrId_);
    } else {
      // Intention is to transfer as ERC-20 token (value).
      return erc20TransferFrom(from_, to_, valueOrId_);
    }

    return true;
  }

  /// @notice Function for ERC-721 transfers from.
  /// @dev This function is recommended for ERC721 transfers
  function erc721TransferFrom(
    address from_,
    address to_,
    uint256 id_
  ) public virtual {
    // Prevent transferring tokens from 0x0.
    if (from_ == address(0)) {
      revert InvalidSender();
    }

    // Prevent burning tokens to 0x0.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    if (from_ != _getOwnerOf(id_)) {
      revert Unauthorized();
    }

    // Check that the operator is either the sender or approved for the transfer.
    if (
      msg.sender != from_ &&
      !isApprovedForAll[from_][msg.sender] &&
      msg.sender != getApproved[id_]
    ) {
      revert Unauthorized();
    }

    if (erc721TransferExempt(to_)) {
      revert RecipientIsERC721TransferExempt();
    }

    // Transfer 1 * units ERC-20 and 1 ERC-721 token.
    // ERC-721 transfer exemptions handled above. Can't make it to this point if either is transfer exempt.
    _transferERC20(from_, to_, units);
    _transferERC721(from_, to_, id_);
  }

  /// @notice Function for ERC-20 transfers from.
  /// @dev This function is recommended for ERC20 transfers
  function erc20TransferFrom(
    address from_,
    address to_,
    uint256 value_
  ) public virtual returns (bool) {
    // Prevent transferring tokens from 0x0.
    if (from_ == address(0)) {
      revert InvalidSender();
    }

    // Prevent burning tokens to 0x0.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    // Intention is to transfer as ERC-20 token (value).
    uint256 allowed = allowance[from_][msg.sender];

    // Check that the operator has sufficient allowance.
    if (allowed != type(uint256).max) {
      allowance[from_][msg.sender] = allowed - value_;
    }

    // Transferring ERC-20s directly requires the _transfer function.
    // Handles ERC-721 exemptions internally.
    return _transferERC20WithERC721(from_, to_, value_);
  }

  /// @notice Function for ERC-20 transfers.
  /// @dev This function assumes the operator is attempting to transfer as ERC-20
  ///      given this function is only supported on the ERC-20 interface.
  ///      Treats even small amounts that are valid ERC-721 ids as ERC-20s.
  function transfer(address to_, uint256 value_) public virtual returns (bool) {
    // Prevent burning tokens to 0x0.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    // Transferring ERC-20s directly requires the _transfer function.
    // Handles ERC-721 exemptions internally.
    return _transferERC20WithERC721(msg.sender, to_, value_);
  }

  /// @notice Function for ERC-721 transfers with contract support.
  /// This function only supports moving valid ERC-721 ids, as it does not exist on the ERC-20
  /// spec and will revert otherwise.
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_
  ) public virtual {
    safeTransferFrom(from_, to_, id_, "");
  }

  /// @notice Function for ERC-721 transfers with contract support and callback data.
  /// This function only supports moving valid ERC-721 ids, as it does not exist on the
  /// ERC-20 spec and will revert otherwise.
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_,
    bytes memory data_
  ) public virtual {
    if (!_isValidTokenId(id_)) {
      revert InvalidTokenId();
    }

    transferFrom(from_, to_, id_);

    if (
      to_.code.length != 0 &&
      IERC721Receiver(to_).onERC721Received(msg.sender, from_, id_, data_) !=
      IERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Function for EIP-2612 permits
  /// @dev Providing type(uint256).max for permit value results in an
  ///      unlimited approval that is not deducted from on transfers.
  function permit(
    address owner_,
    address spender_,
    uint256 value_,
    uint256 deadline_,
    uint8 v_,
    bytes32 r_,
    bytes32 s_
  ) public virtual {
    if (deadline_ < block.timestamp) {
      revert PermitDeadlineExpired();
    }

    if (_isValidTokenId(value_)) {
      revert InvalidApproval();
    }

    if (spender_ == address(0)) {
      revert InvalidSpender();
    }

    unchecked {
      address recoveredAddress = ecrecover(
        keccak256(
          abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR(),
            keccak256(
              abi.encode(
                keccak256(
                  "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner_,
                spender_,
                value_,
                nonces[owner_]++,
                deadline_
              )
            )
          )
        ),
        v_,
        r_,
        s_
      );

      if (recoveredAddress == address(0) || recoveredAddress != owner_) {
        revert InvalidSigner();
      }

      allowance[recoveredAddress][spender_] = value_;
    }

    emit ERC20Events.Approval(owner_, spender_, value_);
  }

  /// @notice Returns domain initial domain separator, or recomputes if chain id is not equal to initial chain id
  function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
    return
      block.chainid == _INITIAL_CHAIN_ID
        ? _INITIAL_DOMAIN_SEPARATOR
        : _computeDomainSeparator();
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual returns (bool) {
    return
      interfaceId == type(IERC404).interfaceId ||
      interfaceId == type(IERC165).interfaceId;
  }

  /// @notice Function for self-exemption
  function setSelfERC721TransferExempt(bool state_) public virtual {
    _setERC721TransferExempt(msg.sender, state_);
  }

  /// @notice Function to check if address is transfer exempt
  function erc721TransferExempt(
    address target_
  ) public view virtual returns (bool) {
    return target_ == address(0) || _erc721TransferExempt[target_];
  }

  /// @notice For a token token id to be considered valid, it just needs
  ///         to fall within the range of possible token ids, it does not
  ///         necessarily have to be minted yet.
  function _isValidTokenId(uint256 id_) internal pure returns (bool) {
    return id_ > ID_ENCODING_PREFIX && id_ != type(uint256).max;
  }

  /// @notice Internal function to compute domain separator for EIP-2612 permits
  function _computeDomainSeparator() internal view virtual returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
          ),
          keccak256(bytes(name)),
          keccak256("1"),
          block.chainid,
          address(this)
        )
      );
  }

  /// @notice This is the lowest level ERC-20 transfer function, which
  ///         should be used for both normal ERC-20 transfers as well as minting.
  /// Note that this function allows transfers to and from 0x0.
  function _transferERC20(
    address from_,
    address to_,
    uint256 value_
  ) internal virtual {
    // Minting is a special case for which we should not check the balance of
    // the sender, and we should increase the total supply.
    if (from_ == address(0)) {
      totalSupply += value_;
    } else {
      // Deduct value from sender's balance.
      balanceOf[from_] -= value_;
    }

    // Update the recipient's balance.
    // Can be unchecked because on mint, adding to totalSupply is checked, and on transfer balance deduction is checked.
    unchecked {
      balanceOf[to_] += value_;
    }

    emit ERC20Events.Transfer(from_, to_, value_);
  }

  /// @notice Consolidated record keeping function for transferring ERC-721s.
  /// @dev Assign the token to the new owner, and remove from the old owner.
  /// Note that this function allows transfers to and from 0x0.
  /// Does not handle ERC-721 exemptions.
  function _transferERC721(
    address from_,
    address to_,
    uint256 id_
  ) internal virtual {
    // If this is not a mint, handle record keeping for transfer from previous owner.
    if (from_ != address(0)) {
      // On transfer of an NFT, any previous approval is reset.
      delete getApproved[id_];

      uint256 updatedId = ID_ENCODING_PREFIX +
        _owned[from_][_owned[from_].length - 1];
      if (updatedId != id_) {
        uint256 updatedIndex = _getOwnedIndex(id_);
        // update _owned for sender
        _owned[from_][updatedIndex] = uint16(updatedId);
        // update index for the moved id
        _setOwnedIndex(updatedId, updatedIndex);
      }

      // pop
      _owned[from_].pop();
    }

    // Check if this is a burn.
    if (to_ != address(0)) {
      // If not a burn, update the owner of the token to the new owner.
      // Update owner of the token to the new owner.
      _setOwnerOf(id_, to_);
      // Push token onto the new owner's stack.
      _owned[to_].push(uint16(id_));
      // Update index for new owner's stack.
      _setOwnedIndex(id_, _owned[to_].length - 1);
    } else {
      // If this is a burn, reset the owner of the token to 0x0 by deleting the token from _ownedData.
      delete _ownedData[id_];
    }

    emit ERC721Events.Transfer(from_, to_, id_);
  }

  /// @notice Internal function for ERC-20 transfers. Also handles any ERC-721 transfers that may be required.
  // Handles ERC-721 exemptions.
  function _transferERC20WithERC721(
    address from_,
    address to_,
    uint256 value_
  ) internal virtual returns (bool) {
    uint256 erc20BalanceOfSenderBefore = erc20BalanceOf(from_);
    uint256 erc20BalanceOfReceiverBefore = erc20BalanceOf(to_);

    _transferERC20(from_, to_, value_);

    // Preload for gas savings on branches
    bool isFromERC721TransferExempt = erc721TransferExempt(from_);
    bool isToERC721TransferExempt = erc721TransferExempt(to_);

    // Skip _withdrawAndStoreERC721 and/or _retrieveOrMintERC721 for ERC-721 transfer exempt addresses
    // 1) to save gas
    // 2) because ERC-721 transfer exempt addresses won't always have/need ERC-721s corresponding to their ERC20s.
    if (isFromERC721TransferExempt && isToERC721TransferExempt) {
      // Case 1) Both sender and recipient are ERC-721 transfer exempt. No ERC-721s need to be transferred.
      // NOOP.
    } else if (isFromERC721TransferExempt) {
      // Case 2) The sender is ERC-721 transfer exempt, but the recipient is not. Contract should not attempt
      //         to transfer ERC-721s from the sender, but the recipient should receive ERC-721s
      //         from the bank/minted for any whole number increase in their balance.
      // Only cares about whole number increments.
      uint256 tokensToRetrieveOrMint = (balanceOf[to_] / units) -
        (erc20BalanceOfReceiverBefore / units);
      for (uint256 i = 0; i < tokensToRetrieveOrMint; ) {
        _retrieveOrMintERC721(to_);
        unchecked {
          ++i;
        }
      }
    } else if (isToERC721TransferExempt) {
      // Case 3) The sender is not ERC-721 transfer exempt, but the recipient is. Contract should attempt
      //         to withdraw and store ERC-721s from the sender, but the recipient should not
      //         receive ERC-721s from the bank/minted.
      // Only cares about whole number increments.
      uint256 tokensToWithdrawAndStore = (erc20BalanceOfSenderBefore / units) -
        (balanceOf[from_] / units);
      for (uint256 i = 0; i < tokensToWithdrawAndStore; ) {
        _withdrawAndStoreERC721(from_);
        unchecked {
          ++i;
        }
      }
    } else {
      // Case 4) Neither the sender nor the recipient are ERC-721 transfer exempt.
      // Strategy:
      // 1. First deal with the whole tokens. These are easy and will just be transferred.
      // 2. Look at the fractional part of the value:
      //   a) If it causes the sender to lose a whole token that was represented by an NFT due to a
      //      fractional part being transferred, withdraw and store an additional NFT from the sender.
      //   b) If it causes the receiver to gain a whole new token that should be represented by an NFT
      //      due to receiving a fractional part that completes a whole token, retrieve or mint an NFT to the recevier.

      // Whole tokens worth of ERC-20s get transferred as ERC-721s without any burning/minting.
      uint256 nftsToTransfer = value_ / units;
      for (uint256 i = 0; i < nftsToTransfer; ) {
        // Pop from sender's ERC-721 stack and transfer them (LIFO)
        uint256 indexOfLastToken = _owned[from_].length - 1;
        uint256 tokenId = ID_ENCODING_PREFIX + _owned[from_][indexOfLastToken];
        _transferERC721(from_, to_, tokenId);
        unchecked {
          ++i;
        }
      }

      // If the sender's transaction changes their holding from a fractional to a non-fractional
      // amount (or vice versa), adjust ERC-721s.
      //
      // Check if the send causes the sender to lose a whole token that was represented by an ERC-721
      // due to a fractional part being transferred.
      if (
        erc20BalanceOfSenderBefore / units - erc20BalanceOf(from_) / units >
        nftsToTransfer
      ) {
        _withdrawAndStoreERC721(from_);
      }

      if (
        erc20BalanceOf(to_) / units - erc20BalanceOfReceiverBefore / units >
        nftsToTransfer
      ) {
        _retrieveOrMintERC721(to_);
      }
    }

    return true;
  }

  /// @notice Internal function for ERC20 minting
  /// @dev This function will allow minting of new ERC20s.
  ///      If mintCorrespondingERC721s_ is true, and the recipient is not ERC-721 exempt, it will
  ///      also mint the corresponding ERC721s.
  /// Handles ERC-721 exemptions.
  function _mintERC20(address to_, uint256 value_) internal virtual {
    /// You cannot mint to the zero address (you can't mint and immediately burn in the same transfer).
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    if (totalSupply + value_ > ID_ENCODING_PREFIX) {
      revert MintLimitReached();
    }

    _transferERC20WithERC721(address(0), to_, value_);
  }

  /// @notice Internal function for ERC-721 minting and retrieval from the bank.
  /// @dev This function will allow minting of new ERC-721s up to the total fractional supply. It will
  ///      first try to pull from the bank, and if the bank is empty, it will mint a new token.
  /// Does not handle ERC-721 exemptions.
  function _retrieveOrMintERC721(address to_) internal virtual {
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    uint256 id;

    if (!_storedERC721Ids.empty()) {
      // If there are any tokens in the bank, use those first.
      // Pop off the end of the queue (FIFO).
      id = ID_ENCODING_PREFIX + _storedERC721Ids.popBack();
    } else {
      // Otherwise, mint a new token, should not be able to go over the total fractional supply.
      ++minted;

      // Reserve max uint256 for approvals
      if (minted == type(uint256).max) {
        revert MintLimitReached();
      }

      id = ID_ENCODING_PREFIX + minted;
    }

    address erc721Owner = _getOwnerOf(id);

    // The token should not already belong to anyone besides 0x0 or this contract.
    // If it does, something is wrong, as this should never happen.
    if (erc721Owner != address(0)) {
      revert AlreadyExists();
    }

    // Transfer the token to the recipient, either transferring from the contract's bank or minting.
    // Does not handle ERC-721 exemptions.
    _transferERC721(erc721Owner, to_, id);
  }

  /// @notice Internal function for ERC-721 deposits to bank (this contract).
  /// @dev This function will allow depositing of ERC-721s to the bank, which can be retrieved by future minters.
  // Does not handle ERC-721 exemptions.
  function _withdrawAndStoreERC721(address from_) internal virtual {
    if (from_ == address(0)) {
      revert InvalidSender();
    }

    // Retrieve the latest token added to the owner's stack (LIFO).
    uint256 id = ID_ENCODING_PREFIX + _owned[from_][_owned[from_].length - 1];

    // Transfer to 0x0.
    // Does not handle ERC-721 exemptions.
    _transferERC721(from_, address(0), id);

    // Record the token in the contract's bank queue.
    _storedERC721Ids.pushFront(uint16(id));
  }

  /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
  function _setERC721TransferExempt(
    address target_,
    bool state_
  ) internal virtual {
    if (target_ == address(0)) {
      revert InvalidExemption();
    }

    // Adjust the ERC721 balances of the target to respect exemption rules.
    // Despite this logic, it is still recommended practice to exempt prior to the target
    // having an active balance.
    if (state_) {
      _clearERC721Balance(target_);
    } else {
      _reinstateERC721Balance(target_);
    }

    _erc721TransferExempt[target_] = state_;
  }

  /// @notice Function to reinstate balance on exemption removal
  function _reinstateERC721Balance(address target_) private {
    uint256 expectedERC721Balance = erc20BalanceOf(target_) / units;
    uint256 actualERC721Balance = erc721BalanceOf(target_);

    for (uint256 i = 0; i < expectedERC721Balance - actualERC721Balance; ) {
      // Transfer ERC721 balance in from pool
      _retrieveOrMintERC721(target_);
      unchecked {
        ++i;
      }
    }
  }

  /// @notice Function to clear balance on exemption inclusion
  function _clearERC721Balance(address target_) private {
    uint256 erc721Balance = erc721BalanceOf(target_);

    for (uint256 i = 0; i < erc721Balance; ) {
      // Transfer out ERC721 balance
      _withdrawAndStoreERC721(target_);
      unchecked {
        ++i;
      }
    }
  }

  function _getOwnerOf(
    uint256 id_
  ) internal view virtual returns (address ownerOf_) {
    uint256 data = _ownedData[id_];

    assembly {
      ownerOf_ := and(data, _BITMASK_ADDRESS)
    }
  }

  function _setOwnerOf(uint256 id_, address owner_) internal virtual {
    uint256 data = _ownedData[id_];

    assembly {
      data := add(
        and(data, _BITMASK_OWNED_INDEX),
        and(owner_, _BITMASK_ADDRESS)
      )
    }

    _ownedData[id_] = data;
  }

  function _getOwnedIndex(
    uint256 id_
  ) internal view virtual returns (uint256 ownedIndex_) {
    uint256 data = _ownedData[id_];

    assembly {
      ownedIndex_ := shr(160, data)
    }
  }

  function _setOwnedIndex(uint256 id_, uint256 index_) internal virtual {
    uint256 data = _ownedData[id_];

    if (index_ > _BITMASK_OWNED_INDEX >> 160) {
      revert OwnedIndexOverflow();
    }

    assembly {
      data := add(
        and(data, _BITMASK_ADDRESS),
        and(shl(160, index_), _BITMASK_OWNED_INDEX)
      )
    }

    _ownedData[id_] = data;
  }
}
