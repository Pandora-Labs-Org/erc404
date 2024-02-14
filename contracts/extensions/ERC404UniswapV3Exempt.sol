//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC404} from "../ERC404.sol";
import {IPeripheryImmutableState} from "@uniswap/v3-periphery/contracts/interfaces/IPeripheryImmutableState.sol";

abstract contract ERC404UniswapV3Exempt is ERC404 {
  constructor(address uniswapV3Router_) {
    IPeripheryImmutableState uniswapV3Router = IPeripheryImmutableState(
      uniswapV3Router_
    );

    // Set the Uniswap v3 swap router as exempt.
    _setERC721TransferExempt(uniswapV3Router_, true);

    uint24[3] memory feeTiers = [uint24(500), uint24(3_000), uint24(10_000)];

    // Determine the Uniswap v3 pair address for this token.
    for (uint256 i = 0; i < feeTiers.length; ) {
      address uniswapV3Pair = _getUniswapV3Pair(
        uniswapV3Router.factory(),
        uniswapV3Router.WETH9(),
        feeTiers[i]
      );

      // Set the Uniswap v3 pair as exempt.
      _setERC721TransferExempt(uniswapV3Pair, true);

      unchecked {
        ++i;
      }
    }
  }

  function _getUniswapV3Pair(
    address uniswapV3Factory_,
    address weth_,
    uint24 fee_
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
                uniswapV3Factory_,
                keccak256(abi.encode(token0, token1, fee_)),
                hex"e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"
              )
            )
          )
        )
      );
  }
}
