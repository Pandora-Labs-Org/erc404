import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers, network } from "hardhat"

describe("ERC404UniswapV2Exempt", function () {
  async function deployERC404ExampleUniswapV2() {
    const signers = await ethers.getSigners()

    // Deploy Uniswap v2 factory.
    const uniswapV2FactorySource = require("@uniswap/v2-core/build/UniswapV2Factory.json")
    const uniswapV2FactoryContract = await new ethers.ContractFactory(
      uniswapV2FactorySource.interface,
      uniswapV2FactorySource.bytecode,
      signers[0],
    ).deploy(signers[0].address)
    await uniswapV2FactoryContract.waitForDeployment()

    // Deploy WETH.
    const wethSource = require("@uniswap/v2-periphery/build/WETH9.json")
    const wethContract = await new ethers.ContractFactory(
      wethSource.interface,
      wethSource.bytecode,
      signers[0],
    ).deploy()
    await wethContract.waitForDeployment()

    // Deploy Uniswap v2 router.
    const uniswapV2RouterSource = require("@uniswap/v2-periphery/build/UniswapV2Router02.json")
    const uniswapV2RouterContract = await new ethers.ContractFactory(
      uniswapV2RouterSource.interface,
      uniswapV2RouterSource.bytecode,
      signers[0],
    ).deploy(
      await uniswapV2FactoryContract.getAddress(),
      await wethContract.getAddress(),
    )
    await uniswapV2RouterContract.waitForDeployment()

    // Deploy the token.

    const factory = await ethers.getContractFactory("ERC404ExampleUniswapV2")

    const name = "ExampleUniswapV2"
    const symbol = "EX-B"
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
      await uniswapV2RouterContract.getAddress(),
    )
    await contract.waitForDeployment()
    const contractAddress = await contract.getAddress()

    // Generate 10 random addresses for experiments.
    const randomAddresses = Array.from(
      { length: 10 },
      () => ethers.Wallet.createRandom().address,
    )

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
        uniswapV2RouterContract,
        uniswapV2FactoryContract,
        wethContract,
      },
      randomAddresses,
    }
  }

  describe("#constructor", function () {
    it("Adds the UniswapV2Router02 to the ERC-721 transfer exempt list", async function () {
      const f = await loadFixture(deployERC404ExampleUniswapV2)

      const uniswapV2RouterContractAddress =
        await f.deployConfig.uniswapV2RouterContract.getAddress()

      expect(uniswapV2RouterContractAddress).to.not.eq(ethers.ZeroAddress)

      expect(
        await f.contract.erc721TransferExempt(
          await f.deployConfig.uniswapV2RouterContract.getAddress(),
        ),
      ).to.equal(true)
    })

    it("Adds the Uniswap v2 Pair address for this token + WETH to the ERC-721 transfer exempt list", async function () {
      const f = await loadFixture(deployERC404ExampleUniswapV2)

      // Create the pair using the Uniswap v2 factory.
      await f.deployConfig.uniswapV2FactoryContract.createPair(
        f.contractAddress,
        await f.deployConfig.wethContract.getAddress(),
      )

      const expectedPairAddress =
        await f.deployConfig.uniswapV2FactoryContract.getPair(
          f.contractAddress,
          await f.deployConfig.wethContract.getAddress(),
        )

      // Pair address is not 0x0.
      expect(expectedPairAddress).to.not.eq(ethers.ZeroAddress)

      expect(
        await f.contract.erc721TransferExempt(await expectedPairAddress),
      ).to.equal(true)
    })
  })
})
