//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

interface IERC404 is IERC165 {
  error NotFound();
  error InvalidTokenId();
  error AlreadyExists();
  error InvalidRecipient();
  error InvalidSender();
  error InvalidSpender();
  error InvalidOperator();
  error UnsafeRecipient();
  error RecipientIsERC721TransferExempt();
  error Unauthorized();
  error InsufficientAllowance();
  error DecimalsTooLow();
  error PermitDeadlineExpired();
  error InvalidSigner();
  error InvalidApproval();
  error OwnedIndexOverflow();
  error MintLimitReached();
  error InvalidExemption();

  function name() external view returns (string memory);
  function symbol() external view returns (string memory);
  function decimals() external view returns (uint8);
  function totalSupply() external view returns (uint256);
  function erc20TotalSupply() external view returns (uint256);
  function erc721TotalSupply() external view returns (uint256);
  function balanceOf(address owner_) external view returns (uint256);
  function erc721BalanceOf(address owner_) external view returns (uint256);
  function erc20BalanceOf(address owner_) external view returns (uint256);
  function erc721TransferExempt(address account_) external view returns (bool);
  function isApprovedForAll(
    address owner_,
    address operator_
  ) external view returns (bool);
  function allowance(
    address owner_,
    address spender_
  ) external view returns (uint256);
  function owned(address owner_) external view returns (uint256[] memory);
  function ownerOf(uint256 id_) external view returns (address erc721Owner);
  function tokenURI(uint256 id_) external view returns (string memory);
  function approve(
    address spender_,
    uint256 valueOrId_
  ) external returns (bool);
  function erc20Approve(
    address spender_,
    uint256 value_
  ) external returns (bool);
  function erc721Approve(address spender_, uint256 id_) external;
  function setApprovalForAll(address operator_, bool approved_) external;
  function transferFrom(
    address from_,
    address to_,
    uint256 valueOrId_
  ) external returns (bool);
  function erc20TransferFrom(
    address from_,
    address to_,
    uint256 value_
  ) external returns (bool);
  function erc721TransferFrom(address from_, address to_, uint256 id_) external;
  function transfer(address to_, uint256 amount_) external returns (bool);
  function getERC721QueueLength() external view returns (uint256);
  function getERC721TokensInQueue(
    uint256 start_,
    uint256 count_
  ) external view returns (uint256[] memory);
  function setSelfERC721TransferExempt(bool state_) external;
  function safeTransferFrom(address from_, address to_, uint256 id_) external;
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_,
    bytes calldata data_
  ) external;
  function DOMAIN_SEPARATOR() external view returns (bytes32);
  function permit(
    address owner_,
    address spender_,
    uint256 value_,
    uint256 deadline_,
    uint8 v_,
    bytes32 r_,
    bytes32 s_
  ) external;
}
