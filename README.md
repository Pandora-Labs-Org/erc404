# ERC-404

> 🚨🚨 This repo contains the next version of ERC-404. It has not yet been fully tested or audited, and is not intended to be used in production yet. 🚨🚨

> Please refer to [this repository](https://github.com/Pandora-Labs-Org/erc404-legacy) for the v1.0 version of ERC-404 that was released with Pandora.

## Changelog

### v2.0-beta

- ERC-721 type token ids are now banked and reused in a FIFO queue instead of increasing forever as they are minted and burned. This allows for a predictable set of NFT token ids, as in a typical NFT collection.
- Transfers of full ERC-20 type tokens now transfer ERC-721 type tokens held by the sender to the recipient. In other words, if you transfer 3 full tokens as an ERC-20 transfer, 3 of the ERC-721s in your wallet will transfer directly to the recipient rather than those ERC-721s being burned and new token ids minted to the recipient.
- Predictable events emitted during transfers, approvals, and other operations that clearly indicate whether attributed to ERC-20 / ERC-721.
- Dedicated functions for returning ERC-20 / ERC-721 balances and total supply.
- Removal of fixed supply cap in core contract, allowing a fixed token supply cap to be added optionally if desired.
- Simplification and centralization of transfer logic.
- Easier to use dedicated minting function.
- EIP-2612 support for permit approvals.
- EIP-165 support.
- Numerous logical optimizations and gas savings.

## Introduction

ERC-404 is an experimental, mixed ERC-20 / ERC-721 implementation with native liquidity and fractionalization. While these two standards are not designed to be mixed, this implementation strives to do so in as robust a manner as possible while minimizing tradeoffs.

In its current implementation, ERC-404 effectively isolates ERC-20 / ERC-721 standard logic or introduces pathing where possible.

Pathing could best be described as a lossy encoding scheme in which token amount data and ids occupy shared space under the assumption that negligible token transfers occupying id space do not or do not need to occur.

Integrating protocols should ideally confirm these paths by checking that submitted parameters are below the token id range or above.

This iteration of ERC-404 specifically aims to address common use-cases and define better interfaces for standardization, that reduce or remove conflicts with existing ERC-20 / ERC-721 consensus.

This standard is entirely experimental and unaudited, while testing has been conducted in an effort to ensure execution is as accurate as possible.

The nature of overlapping standards, however, does imply that integrating protocols will not fully understand their mixed function.

## Usage

To deploy your own ERC-404 token, look at the example provided in the src folder, ExampleERC-404.sol.

### Examples

This is an extremely simple minimal version of an ERC-404 that mints the entire supply to the initial owner of the contract.

Generally the initial tokens minted to the deployer will be added to a DEX as liquidity. The DEX pool address should also be added to the whitelist to prevent minting NFTs to it and burning NFTs from it on transfer.

## Uniswap V3

Use the below as guidelines on how to prepare for and deploy to a Uniswap V3 pool:

To predict the address of your Uniswap V3 Pool, use the following simulator: [https://dashboard.tenderly.co/shared/simulation/92dadba3-92c3-46a2-9ccc-c793cac6c33d](https://dashboard.tenderly.co/shared/simulation/92dadba3-92c3-46a2-9ccc-c793cac6c33d).

To use:

1. Click Re-Simulate in the top right corner.
2. Update the simulation parameters: `tokenA` (your token address), `tokenB` (typically WETH, or `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`), and set the fee tier to either 500, 3000 (for 0.3%), or 10000 (for 1%).
3. Run Simulate, and then expand the Input/Output section. The output on the right column will show the derived pool address.

## Useful Deployment Addresses

```
WETH: 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

# Uniswap v2
UniswapV2Router02: 0x7a250d5630b4cf539739df2c5dacb4c659f2488d
UniswapV2Factory: 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f

# Uniswap v3
UniswapV3Factory: 0x1F98431c8aD98523631AE4a59f267346ea31F984
UniversalRouter: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD
UniversalRouter 2: 0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B
SwapRouter: 0xE592427A0AEce92De3Edee1F18E0157C05861564
SwapRouter02: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
NonfungiblePositionManager: 0xc36442b4a4522e871399cd717abdd847ab11fe88
```

## License

This software is released under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
