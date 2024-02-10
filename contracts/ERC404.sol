//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC404} from "./interfaces/IERC404.sol";
import {ERC721Receiver} from "./lib/ERC721Receiver.sol";
import {DoubleEndedQueue} from "./lib/DoubleEndedQueue.sol";
import {IERC165} from "./lib/interfaces/IERC165.sol";

abstract contract ERC404 is IERC404 {
  using DoubleEndedQueue for DoubleEndedQueue.Uint256Deque;

  /// @dev The queue of ERC-721 tokens stored in the contract.
  DoubleEndedQueue.Uint256Deque private _storedERC721Ids;

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
  uint256 internal _minted;

  /// @dev Initial chain id for EIP-2612 support
  uint256 internal immutable INITIAL_CHAIN_ID;

  /// @dev Initial domain separator for EIP-2612 support
  bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;

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
  mapping(address => uint256[]) internal _owned;

  /// @dev Addresses whitelisted from minting / banking for gas savings (pairs, routers, etc)
  mapping(address => bool) public whitelist;

  /// @dev EIP-2612 nonces
  mapping(address => uint256) public nonces;

  /// @dev Address bitmask for packed ownership data
  uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;

  /// @dev Owned index bitmask for packed ownership data
  uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

  constructor(string memory name_, string memory symbol_, uint8 decimals_) {
    name = name_;
    symbol = symbol_;

    if (decimals_ < 18) {
      revert DecimalsTooLow();
    }

    decimals = decimals_;
    units = 10 ** decimals;

    // EIP-2612 initialization
    INITIAL_CHAIN_ID = block.chainid;
    INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
  }

  /// @notice Function to find owner of a given ERC-721 token
  function ownerOf(
    uint256 id_
  ) public view virtual returns (address erc721Owner) {
    erc721Owner = _getOwnerOf(id_);

    // If the id_ is beyond the range of minted tokens, is 0, or the token is not owned by anyone, revert.
    if (id_ > _minted || id_ == 0 || erc721Owner == address(0)) {
      revert NotFound();
    }
  }

  function owned(
    address owner_
  ) public view virtual returns (uint256[] memory) {
    return _owned[owner_];
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
    return _minted;
  }

  function erc721TokensBankedInQueue() public view virtual returns (uint256) {
    return _storedERC721Ids.length();
  }

  /// @notice tokenURI must be implemented by child contract
  function tokenURI(uint256 id_) public view virtual returns (string memory);

  /// @notice Function for token approvals
  /// @dev This function assumes the operator is attempting to approve an ERC-721
  ///      if valueOrId is less than the minted count. Note: Unlike setApprovalForAll,
  ///      spender_ must be allowed to be 0x0 so that approval can be revoked.
  function approve(
    address spender_,
    uint256 valueOrId_
  ) public virtual returns (bool) {
    // The ERC-721 tokens are 1-indexed, so 0 is not a valid id and indicates that
    // operator is attempting to set the ERC-20 allowance to 0.
    if (valueOrId_ <= _minted && valueOrId_ > 0) {
      // Intention is to approve as ERC-721 token (id).
      uint256 id = valueOrId_;
      address erc721Owner = _getOwnerOf(id);

      if (
        msg.sender != erc721Owner && !isApprovedForAll[erc721Owner][msg.sender]
      ) {
        revert Unauthorized();
      }

      getApproved[id] = spender_;

      emit ERC721Approval(erc721Owner, spender_, id);
    } else {
      // Prevent granting 0x0 an ERC-20 allowance.
      if (spender_ == address(0)) {
        revert InvalidSpender();
      }

      // Intention is to approve as ERC-20 token (value).
      uint256 value = valueOrId_;
      allowance[msg.sender][spender_] = value;

      emit ERC20Approval(msg.sender, spender_, value);
    }

    return true;
  }

  /// @notice Function for ERC-721 approvals
  function setApprovalForAll(address operator_, bool approved_) public virtual {
    // Prevent approvals to 0x0.
    if (operator_ == address(0)) {
      revert InvalidOperator();
    }
    isApprovedForAll[msg.sender][operator_] = approved_;
    emit ApprovalForAll(msg.sender, operator_, approved_);
  }

  /// @notice Function for mixed transfers from an operator that may be different than 'from'.
  /// @dev This function assumes the operator is attempting to transfer an ERC-721
  ///      if valueOrId is less than or equal to current max id.
  function transferFrom(
    address from_,
    address to_,
    uint256 valueOrId_
  ) public virtual returns (bool) {
    // Prevent transferring tokens from 0x0.
    if (from_ == address(0)) {
      revert InvalidSender();
    }

    // Prevent burning tokens to 0x0.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    if (valueOrId_ <= _minted) {
      // Intention is to transfer as ERC-721 token (id).
      uint256 id = valueOrId_;

      if (from_ != _getOwnerOf(id)) {
        revert Unauthorized();
      }

      // Check that the operator is either the sender or approved for the transfer.
      if (
        msg.sender != from_ &&
        !isApprovedForAll[from_][msg.sender] &&
        msg.sender != getApproved[id]
      ) {
        revert Unauthorized();
      }

      // Transfer 1 * units ERC-20 and 1 ERC-721 token.
      _transferERC20(from_, to_, units);
      _transferERC721(from_, to_, id);
    } else {
      // Intention is to transfer as ERC-20 token (value).
      uint256 value = valueOrId_;
      uint256 allowed = allowance[from_][msg.sender];

      // Check that the operator has sufficient allowance.
      if (allowed != type(uint256).max) {
        allowance[from_][msg.sender] = allowed - value;
      }

      // Transferring ERC-20s directly requires the _transfer function.
      _transferERC20WithERC721(from_, to_, value);
    }

    return true;
  }

  /// @notice Function for ERC-20 transfers.
  /// @dev This function assumes the operator is attempting to transfer as ERC-20
  ///      given this function is only supported on the ERC-20 interface
  function transfer(address to_, uint256 value_) public virtual returns (bool) {
    // Prevent burning tokens to 0x0.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    // Transferring ERC-20s directly requires the _transfer function.
    return _transferERC20WithERC721(msg.sender, to_, value_);
  }

  /// @notice Function for ERC-721 transfers with contract support.
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_
  ) public virtual {
    transferFrom(from_, to_, id_);

    if (
      to_.code.length != 0 &&
      ERC721Receiver(to_).onERC721Received(msg.sender, from_, id_, "") !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Function for ERC-721 transfers with contract support and callback data.
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_,
    bytes calldata data_
  ) public virtual {
    transferFrom(from_, to_, id_);

    if (
      to_.code.length != 0 &&
      ERC721Receiver(to_).onERC721Received(msg.sender, from_, id_, data_) !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Function for EIP-2612 permits
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

    if (value_ <= _minted && value_ > 0) {
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

    emit ERC20Approval(owner_, spender_, value_);
  }

  /// @notice Returns domain initial domain separator, or recomputes if chain id is not equal to initial chain id
  function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
    return
      block.chainid == INITIAL_CHAIN_ID
        ? INITIAL_DOMAIN_SEPARATOR
        : _computeDomainSeparator();
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual returns (bool) {
    return
      interfaceId == type(IERC404).interfaceId ||
      interfaceId == type(IERC165).interfaceId;
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

    emit ERC20Transfer(from_, to_, value_);
  }

  /// @notice Consolidated record keeping function for transferring ERC-721s.
  /// @dev Assign the token to the new owner, and remove from the old owner.
  /// Note that this function allows transfers to and from 0x0.
  function _transferERC721(
    address from_,
    address to_,
    uint256 id_
  ) internal virtual {
    // If this is not a mint, handle record keeping for transfer from previous owner.
    if (from_ != address(0)) {
      // On transfer of an NFT, any previous approval is reset.
      delete getApproved[id_];

      uint256 updatedId = _owned[from_][_owned[from_].length - 1];

      if (updatedId != id_) {
        uint256 updatedIndex = _getOwnedIndex(id_);
        // update _owned for sender
        _owned[from_][updatedIndex] = updatedId;
        // update index for the moved id
        _setOwnedIndex(updatedId, updatedIndex);
      }

      // pop
      _owned[from_].pop();
    }

    if (to_ != address(0)) {
      // Update owner of the token to the new owner.
      _setOwnerOf(id_, to_);
      // Push token onto the new owner's stack.
      _owned[to_].push(id_);
      // Update index for new owner's stack.
      _setOwnedIndex(id_, _owned[to_].length - 1);
    } else {
      delete _ownedData[id_];
    }

    emit ERC721Transfer(from_, to_, id_);
  }

  /// @notice Internal function for ERC-20 transfers. Also handles any ERC-721 transfers that may be required.
  function _transferERC20WithERC721(
    address from_,
    address to_,
    uint256 value_
  ) internal virtual returns (bool) {
    uint256 erc20BalanceOfSenderBefore = erc20BalanceOf(from_);
    uint256 erc20BalanceOfReceiverBefore = erc20BalanceOf(to_);

    _transferERC20(from_, to_, value_);

    // Preload for gas savings on branches
    bool isFromWhitelisted = whitelist[from_];
    bool isToWhitelisted = whitelist[to_];

    // Skip _withdrawAndStoreERC721 and/or _retrieveOrMintERC721 for whitelisted addresses
    // 1) to save gas
    // 2) because whitelisted addresses won't always have/need ERC-721s corresponding to their ERC20s.
    if (isFromWhitelisted && isToWhitelisted) {
      // Case 1) Both sender and recipient are whitelisted. No ERC-721s need to be transferred.
      // NOOP.
    } else if (isFromWhitelisted) {
      // Case 2) The sender is whitelisted, but the recipient is not. Contract should not attempt
      //         to transfer ERC-721s from the sender, but the recipient should receive ERC-721s
      //         from the bank/minted for any whole number increase in their balance.
      // Only cares about whole number increments.
      uint256 tokensToRetrieveOrMint = (balanceOf[to_] / units) -
        (erc20BalanceOfReceiverBefore / units);
      for (uint256 i = 0; i < tokensToRetrieveOrMint; i++) {
        _retrieveOrMintERC721(to_);
      }
    } else if (isToWhitelisted) {
      // Case 3) The sender is not whitelisted, but the recipient is. Contract should attempt
      //         to withdraw and store ERC-721s from the sender, but the recipient should not
      //         receive ERC-721s from the bank/minted.
      // Only cares about whole number increments.
      uint256 tokensToWithdrawAndStore = (erc20BalanceOfSenderBefore / units) -
        (balanceOf[from_] / units);
      for (uint256 i = 0; i < tokensToWithdrawAndStore; i++) {
        _withdrawAndStoreERC721(from_);
      }
    } else {
      // Case 4) Neither the sender nor the recipient are whitelisted.
      // Strategy:
      // 1. First deal with the whole tokens. These are easy and will just be transferred.
      // 2. Look at the fractional part of the value:
      //   a) If it causes the sender to lose a whole token that was represented by an NFT due to a
      //      fractional part being transferred, withdraw and store an additional NFT from the sender.
      //   b) If it causes the receiver to gain a whole new token that should be represented by an NFT
      //      due to receiving a fractional part that completes a whole token, retrieve or mint an NFT to the recevier.

      // Whole tokens worth of ERC-20s get transferred as ERC-721s without any burning/minting.
      uint256 nftsToTransfer = value_ / units;
      for (uint256 i = 0; i < nftsToTransfer; i++) {
        // Pop from sender's ERC-721 stack and transfer them (LIFO)
        uint256 indexOfLastToken = _owned[from_].length - 1;
        uint256 tokenId = _owned[from_][indexOfLastToken];
        _transferERC721(from_, to_, tokenId);
      }

      // If the sender's transaction changes their holding from a fractional to a non-fractional
      // amount (or vice versa), adjust ERC-721s.
      //
      // Check if the send causes the sender to lose a whole token that was represented by an ERC-721
      // due to a fractional part being transferred.
      //
      // To check this, look if subtracting the fractional amount from the balance causes the balance to
      // drop below the original balance % units, which represents the number of whole tokens they started with.
      uint256 fractionalAmount = value_ % units;

      if (
        (erc20BalanceOfSenderBefore - fractionalAmount) / units <
        (erc20BalanceOfSenderBefore / units)
      ) {
        _withdrawAndStoreERC721(from_);
      }

      // Check if the receive causes the receiver to gain a whole new token that should be represented
      // by an NFT due to receiving a fractional part that completes a whole token.
      if (
        (erc20BalanceOfReceiverBefore + fractionalAmount) / units >
        (erc20BalanceOfReceiverBefore / units)
      ) {
        _retrieveOrMintERC721(to_);
      }
    }

    return true;
  }

  /// @notice Internal function for ERC20 minting
  /// @dev This function will allow minting of new ERC20s.
  ///      If mintCorrespondingERC721s_ is true, it will also mint the corresponding ERC721s.
  function _mintERC20(
    address to_,
    uint256 value_,
    bool mintCorrespondingERC721s_
  ) internal virtual {
    /// You cannot mint to the zero address (you can't mint and immediately burn in the same transfer).
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    _transferERC20(address(0), to_, value_);

    // If mintCorrespondingERC721s_ is true, mint the corresponding ERC721s.
    if (mintCorrespondingERC721s_) {
      uint256 nftsToRetrieveOrMint = value_ / units;
      for (uint256 i = 0; i < nftsToRetrieveOrMint; i++) {
        _retrieveOrMintERC721(to_);
      }
    }
  }

  /// @notice Internal function for ERC-721 minting and retrieval from the bank.
  /// @dev This function will allow minting of new ERC-721s up to the total fractional supply. It will
  ///      first try to pull from the bank, and if the bank is empty, it will mint a new token.
  function _retrieveOrMintERC721(address to_) internal virtual {
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    uint256 id;

    if (!DoubleEndedQueue.empty(_storedERC721Ids)) {
      // If there are any tokens in the bank, use those first.
      // Pop off the end of the queue (FIFO).
      id = _storedERC721Ids.popBack();
    } else {
      // Otherwise, mint a new token, should not be able to go over the total fractional supply.
      _minted++;
      id = _minted;
    }

    address erc721Owner = _getOwnerOf(id);

    // The token should not already belong to anyone besides 0x0 or this contract.
    // If it does, something is wrong, as this should never happen.
    if (erc721Owner != address(0)) {
      revert AlreadyExists();
    }

    // Transfer the token to the recipient, either transferring from the contract's bank or minting.
    _transferERC721(erc721Owner, to_, id);
  }

  /// @notice Internal function for ERC-721 deposits to bank (this contract).
  /// @dev This function will allow depositing of ERC-721s to the bank, which can be retrieved by future minters.
  function _withdrawAndStoreERC721(address from_) internal virtual {
    if (from_ == address(0)) {
      revert InvalidSender();
    }

    // Retrieve the latest token added to the owner's stack (LIFO).
    uint256 id = _owned[from_][_owned[from_].length - 1];

    // Transfer the token to the contract.
    _transferERC721(from_, address(0), id);

    // Record the token in the contract's bank queue.
    _storedERC721Ids.pushFront(id);
  }

  /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
  function _setWhitelist(address target_, bool state_) internal virtual {
    // If the target has at least 1 full ERC-20 token, they should not be removed from the whitelist
    // because if they were and then they attempted to transfer, it would revert as they would not
    // necessarily have ehough ERC-721s to bank.
    if (erc20BalanceOf(target_) >= units && !state_) {
      revert CannotRemoveFromWhitelist();
    }
    whitelist[target_] = state_;
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
      ownedIndex_ := shl(data, 160)
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
        and(shl(index_, 160), _BITMASK_OWNED_INDEX)
      )
    }

    _ownedData[id_] = data;
  }
}
