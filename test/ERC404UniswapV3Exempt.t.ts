import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers, network } from "hardhat"

describe("ERC404UniswapV3Exempt", function () {
  async function deployERC404ExampleUniswapV3() {
    const signers = await ethers.getSigners()

    // Deploy Uniswap v3 factory.
    const uniswapV3FactorySource = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json")
    const uniswapV3FactoryContract = await new ethers.ContractFactory(
      uniswapV3FactorySource.abi,
      uniswapV3FactorySource.bytecode,
      signers[0],
    ).deploy()
    await uniswapV3FactoryContract.waitForDeployment()

    // Add the 100bps fee tier.
    await uniswapV3FactoryContract.connect(signers[0]).enableFeeAmount(100, 1)

    // Deploy WETH.
    const wethSource = require("@uniswap/v2-periphery/build/WETH9.json")
    const wethContract = await new ethers.ContractFactory(
      wethSource.interface,
      wethSource.bytecode,
      signers[0],
    ).deploy()
    await wethContract.waitForDeployment()

    // Deploy Uniswap v3 NFT Position Manager
    const uniswapV3NonfungiblePositionManagerSource = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json")
    const uniswapV3NonfungiblePositionManagerContract =
      await new ethers.ContractFactory(
        uniswapV3NonfungiblePositionManagerSource.abi,
        uniswapV3NonfungiblePositionManagerSource.bytecode,
        signers[0],
      ).deploy(
        await uniswapV3FactoryContract.getAddress(),
        await wethContract.getAddress(),
        // Skip the token descriptor address (we don't really need this for testing).
        ethers.ZeroAddress,
      )
    await uniswapV3NonfungiblePositionManagerContract.waitForDeployment()

    // Deploy Uniswap v3 router.
    const uniswapV3Router = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json")
    const uniswapV3RouterContract = await new ethers.ContractFactory(
      uniswapV3Router.abi,
      uniswapV3Router.bytecode,
      signers[0],
    ).deploy(
      await uniswapV3FactoryContract.getAddress(),
      await wethContract.getAddress(),
    )
    await uniswapV3RouterContract.waitForDeployment()

    // Deploy the token.

    const factory = await ethers.getContractFactory("ERC404ExampleUniswapV3")

    const name = "ExampleC"
    const symbol = "EX-C"
    const decimals = 18n
    const units = 10n ** decimals
    const maxTotalSupplyERC721 = 100n
    const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
    const initialOwner = signers[0]
    const initialMintRecipient = signers[0]

    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      maxTotalSupplyERC721,
      initialOwner.address,
      initialMintRecipient.address,
      await uniswapV3RouterContract.getAddress(),
      await uniswapV3NonfungiblePositionManagerContract.getAddress(),
    )
    await contract.waitForDeployment()
    const contractAddress = await contract.getAddress()

    // Generate 10 random addresses for experiments.
    const randomAddresses = Array.from(
      { length: 10 },
      () => ethers.Wallet.createRandom().address,
    )

    const feeTiers = [100n, 500n, 3000n, 10000n]

    return {
      contract,
      contractAddress,
      signers,
      deployConfig: {
        name,
        symbol,
        decimals,
        units,
        maxTotalSupplyERC721,
        maxTotalSupplyERC20,
        initialOwner,
        initialMintRecipient,
        uniswapV3RouterContract,
        uniswapV3FactoryContract,
        uniswapV3NonfungiblePositionManagerContract,
        wethContract,
      },
      randomAddresses,
      feeTiers,
    }
  }

  describe("#constructor", function () {
    it("Adds the Uniswap v3 nonfungible position manager to the ERC-721 transfer exempt list", async function () {
      const f = await loadFixture(deployERC404ExampleUniswapV3)

      const uniswapV3NonfungiblePositionManagerContractAddress =
        await f.deployConfig.uniswapV3NonfungiblePositionManagerContract.getAddress()

      expect(uniswapV3NonfungiblePositionManagerContractAddress).to.not.eq(
        ethers.ZeroAddress,
      )

      expect(
        await f.contract.erc721TransferExempt(
          await f.deployConfig.uniswapV3NonfungiblePositionManagerContract.getAddress(),
        ),
      ).to.equal(true)
    })

    it("Adds the Uniswap v3 Swap Router to the ERC-721 transfer exempt list", async function () {
      const f = await loadFixture(deployERC404ExampleUniswapV3)

      const uniswapV3RouterContractAddress =
        await f.deployConfig.uniswapV3RouterContract.getAddress()

      expect(uniswapV3RouterContractAddress).to.not.eq(ethers.ZeroAddress)

      expect(
        await f.contract.erc721TransferExempt(
          await f.deployConfig.uniswapV3RouterContract.getAddress(),
        ),
      ).to.equal(true)
    })

    it("Adds the Uniswap v3 Pool addresses for all fee tiers for this token + WETH to the ERC-721 transfer exempt list", async function () {
      const f = await loadFixture(deployERC404ExampleUniswapV3)

      // Check all fee tiers.
      for (const feeTier of f.feeTiers) {
        await f.deployConfig.uniswapV3FactoryContract.createPool(
          f.contractAddress,
          await f.deployConfig.wethContract.getAddress(),
          feeTier,
        )

        const expectedPairAddress =
          await f.deployConfig.uniswapV3FactoryContract.getPool(
            f.contractAddress,
            await f.deployConfig.wethContract.getAddress(),
            feeTier,
          )

        // Pair address is not 0x0.
        expect(expectedPairAddress).to.not.eq(ethers.ZeroAddress)

        expect(
          await f.contract.erc721TransferExempt(await expectedPairAddress),
        ).to.equal(true)
      }
    })

    it.skip("Reverts if WETH9 address doesn't match between the v3 router and the nf position manager", async function () {
      // TODO
    })

    it.skip("Reverts if the factory address doesn't match between the v3 router and the v3 nonfungible position manager", async function () {
      // TODO
    })
  })
})
