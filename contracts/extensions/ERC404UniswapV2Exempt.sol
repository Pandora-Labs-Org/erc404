//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC404} from "../ERC404.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

abstract contract ERC404UniswapV2Exempt is ERC404 {
  constructor(address uniswapV2Router_) {
    IUniswapV2Router02 uniswapV2RouterContract = IUniswapV2Router02(
      uniswapV2Router_
    );

    // Set the Uniswap v2 router as exempt.
    _setERC721TransferExempt(uniswapV2Router_, true);

    // Determine the Uniswap v2 pair address for this token.
    address uniswapV2Pair = _getUniswapV2Pair(
      uniswapV2RouterContract.factory(),
      uniswapV2RouterContract.WETH()
    );

    // Set the Uniswap v2 pair as exempt.
    _setERC721TransferExempt(uniswapV2Pair, true);
  }

  function _getUniswapV2Pair(
    address uniswapV2Factory_,
    address weth_
  ) private view returns (address) {
    address thisAddress = address(this);

    (address token0, address token1) = thisAddress < weth_
      ? (thisAddress, weth_)
      : (weth_, thisAddress);

    return
      address(
        uint160(
          uint256(
            keccak256(
              abi.encodePacked(
                hex"ff",
                uniswapV2Factory_,
                keccak256(abi.encodePacked(token0, token1)),
                hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"
              )
            )
          )
        )
      );
  }
}
