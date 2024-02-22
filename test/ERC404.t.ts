import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers, network } from "hardhat"

describe("ERC404", function () {
  async function deployERC404Example() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("ERC404Example")

    const name = "Example"
    const symbol = "EX-A"
    const decimals = 18n
    const units = 10n ** decimals
    const maxTotalSupplyERC721 = 100n
    const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
    const initialOwner = signers[0]
    const initialMintRecipient = signers[0]
    const idPrefix =
      57896044618658097711785492504343953926634992332820282019728792003956564819968n

    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      maxTotalSupplyERC721,
      initialOwner.address,
      initialMintRecipient.address,
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
        idPrefix,
      },
      randomAddresses,
    }
  }

  async function getPermitSignature(
    contractAddress: string,
    msgSender: any,
    spender: any,
    value: bigint,
    nonce: bigint,
    deadline: bigint,
  ) {
    const domain = {
      name: "Example",
      version: "1",
      chainId: network.config.chainId as number,
      verifyingContract: contractAddress,
    }

    const types = {
      Permit: [
        {
          name: "owner",
          type: "address",
        },
        {
          name: "spender",
          type: "address",
        },
        {
          name: "value",
          type: "uint256",
        },
        {
          name: "nonce",
          type: "uint256",
        },
        {
          name: "deadline",
          type: "uint256",
        },
      ],
    }

    // set the Permit type values
    const values = {
      owner: msgSender.address,
      spender: spender,
      value: value,
      nonce: nonce,
      deadline: deadline,
    }

    // sign the Permit type data with the deployer's private key
    const signature = await msgSender.signTypedData(domain, types, values)

    // split the signature into its components
    return ethers.Signature.from(signature)
  }

  async function getSigners() {
    const signers = await ethers.getSigners()

    return {
      bob: signers[0],
      alice: signers[1],
      jason: signers[2],
      patty: signers[3],
      linda: signers[4],
      larry: signers[5],
      tom: signers[6],
      adam: signers[7],
      julie: signers[8],
      robert: signers[9],
      amy: signers[10],
      ...signers,
    }
  }

  async function deployMinimalERC404() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("MinimalERC404")

    const name = "Example"
    const symbol = "EX-A"
    const decimals = 18n
    const units = 10n ** decimals
    const maxTotalSupplyERC721 = 100n
    const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
    const initialOwner = signers[0]
    const initialMintRecipient = signers[0]
    const idPrefix =
      57896044618658097711785492504343953926634992332820282019728792003956564819968n

    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      initialOwner.address,
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
        initialMintRecipient,
        initialOwner,
        idPrefix,
      },
      randomAddresses,
    }
  }

  async function deployMinimalERC404WithERC20sAndERC721sMinted() {
    const f = await loadFixture(deployMinimalERC404)

    // Mint the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
    await f.contract
      .connect(f.signers[0])
      .mintERC20(
        f.deployConfig.initialMintRecipient.address,
        f.deployConfig.maxTotalSupplyERC20,
      )

    return f
  }

  async function deployMockContractsForERC721Receiver() {
    const mockValidERC721ReceiverFactory = await ethers.getContractFactory(
      "MockValidERC721Receiver",
    )

    const mockValidERC721Receiver =
      await mockValidERC721ReceiverFactory.deploy()
    await mockValidERC721Receiver.waitForDeployment()

    const mockInvalidERC721ReceiverFactory = await ethers.getContractFactory(
      "MockInvalidERC721Receiver",
    )

    const mockInvalidERC721Receiver =
      await mockInvalidERC721ReceiverFactory.deploy()
    await mockInvalidERC721Receiver.waitForDeployment()

    return {
      mockValidERC721Receiver,
      mockInvalidERC721Receiver,
    }
  }

  async function deployMinimalERC404ForHavingAlreadyGrantedApprovalForAllTests() {
    const f = await loadFixture(deployMinimalERC404WithERC20sAndERC721sMinted)

    const msgSender = f.signers[0]
    const intendedOperator = f.signers[1]
    const secondOperator = f.signers[2]

    // Add an approved for all operator for msgSender
    await f.contract
      .connect(msgSender)
      .setApprovalForAll(intendedOperator.address, true)

    return {
      ...f,
      msgSender,
      intendedOperator,
      secondOperator,
    }
  }

  async function deployERC404ExampleWithTokensInSecondSigner() {
    const f = await loadFixture(deployERC404Example)
    const from = f.signers[1]
    const to = f.signers[2]

    // Start off with 100 full tokens.
    const initialExperimentBalanceERC721 = 100n
    const initialExperimentBalanceERC20 =
      initialExperimentBalanceERC721 * f.deployConfig.units

    const balancesBeforeSigner0 = await getBalances(
      f.contract,
      f.signers[0].address,
    )
    const balancesBeforeSigner1 = await getBalances(
      f.contract,
      f.signers[1].address,
    )

    // console.log("balancesBeforeSigner0", balancesBeforeSigner0)
    // console.log("balancesBeforeSigner1", balancesBeforeSigner1)

    // Add the owner to the exemption list
    await f.contract
      .connect(f.signers[0])
      .setERC721TransferExempt(f.signers[0].address, true)

    // Transfer all tokens from the owner to 'from', who is the initial sender for the tests.
    await f.contract
      .connect(f.signers[0])
      .transfer(from.address, initialExperimentBalanceERC20)

    return {
      ...f,
      initialExperimentBalanceERC20,
      initialExperimentBalanceERC721,
      from,
      to,
    }
  }

  async function deployERC404ExampleWithSomeTokensTransferredToRandomAddress() {
    const f = await loadFixture(deployERC404Example)

    const targetAddress = f.randomAddresses[0]

    // Transfer some tokens to a non-exempted wallet to generate the NFTs.
    await f.contract
      .connect(f.signers[0])
      .transfer(targetAddress, 5n * f.deployConfig.units)

    expect(await f.contract.erc721TotalSupply()).to.equal(5n)

    return {
      ...f,
      targetAddress,
    }
  }

  async function getBalances(contract: any, address: string) {
    return {
      erc20: await contract.erc20BalanceOf(address),
      erc721: await contract.erc721BalanceOf(address),
    }
  }

  function containsERC721TransferEvent(
    logs: any[],
    from: string,
    to: string,
    id: bigint,
  ) {
    for (const log of logs) {
      if (log.topics.length == 4) {
        if (
          log.topics[0] ==
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
          log.topics[1] ==
            "0x000000000000000000000000" +
              from.substring(2, from.length).toLowerCase() &&
          log.topics[2] ==
            "0x000000000000000000000000" +
              to.substring(2, to.length).toLowerCase() &&
          log.topics[3] == "0x" + id.toString(16)
        ) {
          return true
        }
      }
    }

    return false
  }

  function containsERC721ApprovalEvent(
    logs: any[],
    owner: string,
    spender: string,
    id: bigint,
  ) {
    for (const log of logs) {
      if (log.topics.length == 4) {
        if (
          log.topics[0] ==
            "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925" &&
          log.topics[1] ==
            "0x000000000000000000000000" +
              owner.substring(2, owner.length).toLowerCase() &&
          log.topics[2] ==
            "0x000000000000000000000000" +
              spender.substring(2, spender.length).toLowerCase() &&
          log.topics[3] == "0x" + id.toString(16)
        ) {
          return true
        }
      }
    }

    return false
  }

  describe("#constructor", function () {
    it("Initializes the contract with the expected values", async function () {
      const f = await loadFixture(deployERC404Example)

      expect(await f.contract.name()).to.equal(f.deployConfig.name)
      expect(await f.contract.symbol()).to.equal(f.deployConfig.symbol)
      expect(await f.contract.decimals()).to.equal(f.deployConfig.decimals)
      expect(await f.contract.owner()).to.equal(
        f.deployConfig.initialOwner.address,
      )
    })

    it("Mints the initial supply of tokens to the initial mint recipient", async function () {
      const f = await loadFixture(deployERC404Example)

      // Expect full supply of ERC20 tokens to be minted to the initial recipient.
      expect(
        await f.contract.erc20BalanceOf(
          f.deployConfig.initialMintRecipient.address,
        ),
      ).to.equal(f.deployConfig.maxTotalSupplyERC20)
      // Expect 0 ERC721 tokens to be minted to the initial recipient, since 1) the user is on the exemption list and 2) the supply is minted using _mintERC20 with mintCorrespondingERC721s_ set to false.
      expect(
        await f.contract.erc721BalanceOf(
          f.deployConfig.initialMintRecipient.address,
        ),
      ).to.equal(0n)

      // NFT minted count should be 0.
      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      // Total supply of ERC20s tokens should be equal to the initial mint recipient's balance.
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
    })

    it("Initializes the exemption list with the initial mint recipient", async function () {
      const f = await loadFixture(deployERC404Example)

      expect(
        await f.contract.erc721TransferExempt(
          f.deployConfig.initialMintRecipient.address,
        ),
      ).to.equal(true)
    })
  })

  describe("#erc20TotalSupply", function () {
    it("Returns the correct total supply", async function () {
      const f = await loadFixture(
        deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
      )

      expect(await f.contract.erc20TotalSupply()).to.eq(
        100n * f.deployConfig.units,
      )
    })
  })

  describe("#erc721TotalSupply", function () {
    it("Returns the correct total supply", async function () {
      const f = await loadFixture(
        deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
      )

      expect(await f.contract.erc721TotalSupply()).to.eq(5n)
    })
  })

  describe("#ownerOf", function () {
    context("Some tokens have been minted", function () {
      it("Reverts if the token ID is below the allowed range", async function () {
        const f = await loadFixture(
          deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
        )

        const minimumValidTokenId = (await f.contract.ID_ENCODING_PREFIX()) + 1n

        expect(await f.contract.ownerOf(minimumValidTokenId)).to.eq(
          f.targetAddress,
        )

        await expect(
          f.contract.ownerOf(minimumValidTokenId - 1n),
        ).to.be.revertedWithCustomError(f.contract, "InvalidTokenId")
      })

      it("Reverts if the token ID is within the range of valid Ids, but is above 'minted', the max valid minted id", async function () {
        const f = await loadFixture(
          deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
        )

        const minted = await f.contract.minted()

        const mintedWithPrefix =
          (await f.contract.ID_ENCODING_PREFIX()) + minted

        expect(await f.contract.ownerOf(mintedWithPrefix)).to.eq(
          f.targetAddress,
        )

        await expect(
          f.contract.ownerOf(mintedWithPrefix + 1n),
        ).to.be.revertedWithCustomError(f.contract, "NotFound")
      })

      it("Reverts when for id = MAX_INT", async function () {
        const f = await loadFixture(
          deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
        )

        const maxId = 2n ** 256n - 1n

        await expect(f.contract.ownerOf(maxId)).to.be.revertedWithCustomError(
          f.contract,
          "InvalidTokenId",
        )
      })

      it("Returns the address of the owner of the token", async function () {
        const f = await loadFixture(
          deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
        )

        // Transferred 5 full tokens from a exempted address to the target address (not exempted), which minted the first 5 NFTs.

        // Expect the owner of the token to be the recipient
        for (let i = 1n; i <= 5n; i++) {
          expect(
            await f.contract.ownerOf(f.deployConfig.idPrefix + i),
          ).to.equal(f.targetAddress)
        }
      })
    })
  })

  describe("Minting out the total supply", function () {
    it("Allows minting of the full supply of ERC20 + ERC721 tokens", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
        )

      // Expect the total supply to be equal to the max total supply
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )

      // Expect the minted count to be equal to the max total supply
      expect(await f.contract.erc721TotalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )
    })

    it("Allows minting of the full supply of ERC20 tokens only", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract.setERC721TransferExempt(f.signers[1].address, true)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
        )

      // Expect the total supply to be equal to the max total supply
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
      expect(await f.contract.erc721TotalSupply()).to.equal(0n)
    })
  })

  describe("Storage and retrieval of unused ERC721s on contract", function () {
    it("Mints ERC721s from 0x0 when the contract's bank is empty", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Total supply should be 0
      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      // Expect the contract's bank to be empty
      expect(await f.contract.balanceOf(f.contractAddress)).to.equal(0n)
      expect(await f.contract.getERC721QueueLength()).to.equal(0n)

      const nftQty = 10n
      const value = nftQty * f.deployConfig.units

      // Mint 10 ERC721s
      const mintTx = await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, value)

      const receipt = await mintTx.wait()

      // Check for ERC721Transfer mint events (from 0x0 to the recipient)
      for (let i = 1n; i <= nftQty; i++) {
        expect(
          containsERC721TransferEvent(
            receipt.logs,
            ethers.ZeroAddress,
            f.signers[1].address,
            f.deployConfig.idPrefix + i,
          ),
        ).to.eq(true)
      }

      // Check for ERC20Transfer mint events (from 0x0 to the recipient)
      await expect(mintTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(ethers.ZeroAddress, f.signers[1].address, value)

      // 10 NFTs should have been minted
      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // Expect the recipient to have 10 NFTs
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        10n,
      )
    })

    it("Stores ERC721s in contract's bank when a sender loses a full token", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Total supply should be 0
      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      // Expect the contract's bank to be empty
      expect(await f.contract.balanceOf(f.contractAddress)).to.equal(0n)
      expect(await f.contract.getERC721QueueLength()).to.equal(0n)

      const nftQty = 10n
      const value = nftQty * f.deployConfig.units

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, value)

      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // Expect the contract's bank to be empty
      expect(await f.contract.balanceOf(f.contractAddress)).to.equal(0n)
      expect(await f.contract.getERC721QueueLength()).to.equal(0n)

      // Move a fraction of a token to another address to break apart a full NFT.

      const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens
      const fractionalTransferTx = await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, fractionalValueToTransferERC20)

      await expect(fractionalTransferTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(
          f.signers[1].address,
          f.signers[2].address,
          fractionalValueToTransferERC20,
        )

      // Expect token id 10 to be transferred to the contract's address (popping the last NFT from the sender's stack)
      await expect(
        containsERC721TransferEvent(
          (await fractionalTransferTx.wait()).logs,
          f.signers[1].address,
          ethers.ZeroAddress,
          f.deployConfig.idPrefix + 10n,
        ),
      ).to.eq(true)

      // 10 tokens still minted, nothing changes there.
      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // The owner of NFT 10 should be the 0x0
      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 10n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      // The sender's NFT balance should be 9
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        9n,
      )

      // The contract's balance is still 0
      expect(await f.contract.balanceOf(f.contractAddress)).to.equal(0n)
      // The contract's bank to contain 1 NFT
      expect(await f.contract.getERC721QueueLength()).to.equal(1n)
    })

    it("Retrieves ERC721s from the contract's bank when the contract's bank holds NFTs and the user regains a full token", async function () {
      const f = await loadFixture(deployMinimalERC404)

      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      const nftQty = 10n
      const erc20Value = nftQty * f.deployConfig.units

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, erc20Value)

      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // Move a fraction of a token to another address to break apart a full NFT.
      const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens

      await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, fractionalValueToTransferERC20)

      // The owner of NFT 10 should be the contract's address
      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 10n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      // The sender's NFT balance should be 9
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        9n,
      )

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)
      // The contract's bank should contain 1 NFTs
      expect(await f.contract.getERC721QueueLength()).to.equal(1n)

      // Transfer the fractional portion needed to regain a full token back to the original sender
      const regainFullTokenTx = await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[1].address, fractionalValueToTransferERC20)

      expect(regainFullTokenTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(
          f.signers[2].address,
          f.signers[1].address,
          fractionalValueToTransferERC20,
        )
      expect(regainFullTokenTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(
          ethers.ZeroAddress,
          f.signers[1].address,
          f.deployConfig.idPrefix + 9n,
        )

      // Original sender's ERC20 balance should be 10 * units
      expect(await f.contract.erc20BalanceOf(f.signers[1].address)).to.equal(
        erc20Value,
      )

      // The owner of NFT 9 should be the original sender's address
      expect(await f.contract.ownerOf(f.deployConfig.idPrefix + 10n)).to.equal(
        f.signers[1].address,
      )

      // The sender's NFT balance should be 10
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        10n,
      )

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)
      // The contract's bank should contain 0 NFTs
      expect(await f.contract.getERC721QueueLength()).to.equal(0n)
    })
  })

  describe("ERC20 token transfer logic for triggering ERC721 transfers", function () {
    context(
      "Fractional transfers (moving less than 1 full token) that trigger ERC721 transfers",
      async function () {
        it("Handles the case of the receiver gaining a whole new token", async function () {
          const f = await loadFixture(
            deployERC404ExampleWithTokensInSecondSigner,
          )

          // Receiver starts out with 0.9 tokens
          const startingBalanceOfReceiver = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, startingBalanceOfReceiver)

          // Initial balances
          const fromBalancesBefore = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesBefore = await getBalances(f.contract, f.to.address)

          // console.log("fromBalancesBefore", fromBalancesBefore)
          // console.log("toBalancesBefore", toBalancesBefore)

          // Ensure that the receiver has 0.9 tokens and 0 NFTs.
          expect(toBalancesBefore.erc20).to.equal(startingBalanceOfReceiver)
          expect(toBalancesBefore.erc721).to.equal(0n)

          // Transfer an amount that results in the receiver gaining a whole new token (0.9 + 0.1)
          const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, fractionalValueToTransferERC20)

          // Post-transfer balances
          const fromBalancesAfter = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesAfter = await getBalances(f.contract, f.to.address)

          // console.log("fromBalancesAfter", fromBalancesAfter)
          // console.log("toBalancesAfter", toBalancesAfter)

          // Verify ERC20 balances after transfer
          expect(fromBalancesAfter.erc20).to.equal(
            fromBalancesBefore.erc20 - fractionalValueToTransferERC20,
          )
          expect(toBalancesAfter.erc20).to.equal(
            toBalancesBefore.erc20 + fractionalValueToTransferERC20,
          )

          // Verify ERC721 balances after transfer
          // Assuming the receiver should have gained 1 NFT due to the transfer completing a whole token
          expect(fromBalancesAfter.erc721).to.equal(fromBalancesBefore.erc721) // No change for the sender
          expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721 + 1n)
        })

        it("Handles the case of the sender losing a partial token, dropping it below a full token", async function () {
          const f = await loadFixture(
            deployERC404ExampleWithTokensInSecondSigner,
          )

          // Initial balances
          const fromBalancesBefore = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesBefore = await getBalances(f.contract, f.to.address)

          expect(fromBalancesBefore.erc20 / f.deployConfig.units).to.equal(100n)

          // Sender starts with 100 tokens and sends 0.1, resulting in the loss of 1 NFT but no NFT transfer to the receiver.
          const initialFractionalAmount = f.deployConfig.units / 10n // 0.1 token in sub-units
          const transferAmount = initialFractionalAmount * 1n // 0.1 tokens, ensuring a loss of a whole token after transfer

          // Perform the transfer
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, transferAmount)

          // Post-transfer balances
          const fromBalancesAfter = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesAfter = await getBalances(f.contract, f.to.address)

          // Verify ERC20 balances after transfer
          expect(fromBalancesAfter.erc20).to.equal(
            fromBalancesBefore.erc20 - transferAmount,
          )
          expect(toBalancesAfter.erc20).to.equal(
            toBalancesBefore.erc20 + transferAmount,
          )

          // Verify ERC721 balances after transfer
          // Assuming the sender should lose 1 NFT due to the transfer causing a loss of a whole token.
          // Sender loses an NFT
          expect(fromBalancesAfter.erc721).to.equal(
            fromBalancesBefore.erc721 - 1n,
          )
          // No NFT gain for the receiver
          expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721)
          // Contract gains an NFT (it's stored in the contract in this scenario).
          // TODO - Verify this with the contract's balance.
        })
      },
    )

    context("Moving one or more full tokens", async function () {
      it("Transfers whole tokens without fractional impact correctly", async function () {
        const f = await loadFixture(deployERC404ExampleWithTokensInSecondSigner)

        // Initial balances
        const fromBalancesBefore = await getBalances(f.contract, f.from.address)
        const toBalancesBefore = await getBalances(f.contract, f.to.address)

        // Expect initial balances to match setup
        expect(fromBalancesBefore.erc20).to.equal(
          f.initialExperimentBalanceERC20,
        )
        expect(fromBalancesBefore.erc721).to.equal(
          f.initialExperimentBalanceERC721,
        )
        expect(toBalancesBefore.erc20).to.equal(0n)
        expect(toBalancesBefore.erc721).to.equal(0n)

        // Transfer 2 whole tokens
        const erc721TokensToTransfer = 2n
        const valueToTransferERC20 =
          erc721TokensToTransfer * f.deployConfig.units
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, valueToTransferERC20)

        // Post-transfer balances
        const fromBalancesAfter = await getBalances(f.contract, f.from.address)
        const toBalancesAfter = await getBalances(f.contract, f.to.address)

        // Verify ERC20 balances after transfer
        expect(fromBalancesAfter.erc20).to.equal(
          fromBalancesBefore.erc20 - valueToTransferERC20,
        )
        expect(toBalancesAfter.erc20).to.equal(
          toBalancesBefore.erc20 + valueToTransferERC20,
        )

        // Verify ERC721 balances after transfer - Assuming 2 NFTs should have been transferred
        expect(fromBalancesAfter.erc721).to.equal(
          fromBalancesBefore.erc721 - erc721TokensToTransfer,
        )
        expect(toBalancesAfter.erc721).to.equal(
          toBalancesBefore.erc721 + erc721TokensToTransfer,
        )
      })

      it("Handles the case of sending 3.2 tokens where the sender started out with 99.1 tokens and the receiver started with 0.9 tokens", async function () {
        // This test demonstrates all 3 cases in one scenario:
        // - The sender loses a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        // - The receiver gains a whole new token (0.9 + 3.2 (3 whole, 0.2 fractional) = 4.1)
        // - The sender transfers 3 whole tokens to the receiver (99.1 - 3.2 (3 whole, 0.2 fractional) = 95.9)

        const f = await loadFixture(deployERC404ExampleWithTokensInSecondSigner)

        // Receiver starts out with 0.9 tokens
        const startingBalanceOfReceiver = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, startingBalanceOfReceiver)

        // Initial balances
        const fromBalancesBefore = await getBalances(f.contract, f.from.address)
        const toBalancesBefore = await getBalances(f.contract, f.to.address)

        // console.log("fromBalancesBefore", fromBalancesBefore)
        // console.log("toBalancesBefore", toBalancesBefore)

        // Ensure that the receiver has 0.9 tokens and 0 NFTs.
        expect(toBalancesBefore.erc20).to.equal(startingBalanceOfReceiver)
        expect(toBalancesBefore.erc721).to.equal(0n)

        // Transfer an amount that results in:
        // - the receiver gaining a whole new token (0.9 + 0.2 + 3)
        // - the sender losing a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        const fractionalValueToTransferERC20 =
          (f.deployConfig.units / 10n) * 32n // 3.2 tokens
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, fractionalValueToTransferERC20)

        // Post-transfer balances
        const fromBalancesAfter = await getBalances(f.contract, f.from.address)
        const toBalancesAfter = await getBalances(f.contract, f.to.address)

        // console.log("fromBalancesAfter", fromBalancesAfter)
        // console.log("toBalancesAfter", toBalancesAfter)

        // Verify ERC20 balances after transfer
        expect(fromBalancesAfter.erc20).to.equal(
          fromBalancesBefore.erc20 - fractionalValueToTransferERC20,
        )
        expect(toBalancesAfter.erc20).to.equal(
          toBalancesBefore.erc20 + fractionalValueToTransferERC20,
        )

        // Verify ERC721 balances after transfer
        // The receiver should have gained 3 NFTs from the transfer and 1 NFT due to the transfer completing a whole token for a total of +4 NFTs.
        expect(fromBalancesAfter.erc721).to.equal(
          fromBalancesBefore.erc721 - 4n,
        )
        expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721 + 4n)
      })
    })
  })

  describe("#safeTransferFrom", function () {
    it('Calling without data parameter calls overloaded function with "" as data', async function () {
      const f = await loadFixture(deployMinimalERC404WithERC20sAndERC721sMinted)

      const tokenId = 1n

      // Transfer 1 token from the sender to the receiver
      await f.contract
        .connect(f.signers[0])
        .safeTransferFrom(
          f.signers[0].address,
          f.signers[1].address,
          f.deployConfig.idPrefix + tokenId,
        )

      // The receiver of the NFT should be the owner
      expect(
        await f.contract.ownerOf(f.deployConfig.idPrefix + tokenId),
      ).to.equal(f.signers[1].address)
    })

    it("Reverts when transferring token 0", async function () {
      const f = await loadFixture(deployMinimalERC404WithERC20sAndERC721sMinted)

      await expect(
        f.contract
          .connect(f.signers[0])
          .safeTransferFrom(
            f.signers[0].address,
            f.signers[1].address,
            f.deployConfig.idPrefix + 0n,
          ),
      ).to.be.revertedWithCustomError(f.contract, "InvalidTokenId")
    })

    it("Reverts when transferring a token id above the minted range", async function () {
      const f = await loadFixture(deployMinimalERC404WithERC20sAndERC721sMinted)

      const tokenId = (await f.contract.erc721TotalSupply()) + 1n

      await expect(
        f.contract
          .connect(f.signers[0])
          .safeTransferFrom(
            f.signers[0].address,
            f.signers[1].address,
            tokenId,
          ),
      ).to.be.revertedWithCustomError(f.contract, "InvalidTokenId")
    })

    context("Recipient is a contract", function () {
      context("Recipient is a valid ERC721Receiver", function () {
        it("Successfully transfers a valid ERC-721", async function () {
          const f = await loadFixture(
            deployMinimalERC404WithERC20sAndERC721sMinted,
          )
          const f2 = await loadFixture(deployMockContractsForERC721Receiver)

          const tokenId = f.deployConfig.idPrefix + 1n

          // Transfer 1 token from the sender to the receiver
          await expect(
            f.contract
              .connect(f.signers[0])
              .safeTransferFrom(
                f.signers[0].address,
                await f2.mockValidERC721Receiver.getAddress(),
                tokenId,
              ),
          ).to.emit(f.contract, "Transfer")
        })
      })

      context("Recipient is not a valid ERC721Receiver", function () {
        it("Fails to transfer a valid ERC-721", async function () {
          const f = await loadFixture(
            deployMinimalERC404WithERC20sAndERC721sMinted,
          )
          const f2 = await loadFixture(deployMockContractsForERC721Receiver)

          const tokenId = f.deployConfig.idPrefix + 1n

          // Transfer 1 token from the sender to the receiver
          await expect(
            f.contract
              .connect(f.signers[0])
              .safeTransferFrom(
                f.signers[0].address,
                await f2.mockInvalidERC721Receiver.getAddress(),
                tokenId,
              ),
          ).to.be.revertedWithCustomError(f.contract, "UnsafeRecipient")
        })
      })
    })
  })

  describe("#transferFrom", function () {
    it("Doesn't allow anyone to transfer from 0x0", async function () {
      const f = await loadFixture(deployERC404Example)

      // Attempt to transfer from 0x0. This will always fail as it's not possible for the 0x0 address to sign a transaction, so it can neither send a transfer nor give another address an allowance.
      await expect(
        f.contract
          .connect(f.signers[0])
          .transferFrom(ethers.ZeroAddress, f.signers[1].address, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InvalidSender")
    })

    it("Doesn't allow anyone to transfer to 0x0", async function () {
      const f = await loadFixture(deployERC404Example)

      // Attempt to transfer to 0x0.
      await expect(
        f.contract
          .connect(f.signers[0])
          .transferFrom(f.signers[0], ethers.ZeroAddress, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InvalidRecipient")
    })

    it("Doesn't allow anyone to transfer from 0x0 to 0x0", async function () {
      const f = await loadFixture(deployERC404Example)

      // Attempt to transfer to 0x0 from 0x0.
      await expect(
        f.contract
          .connect(f.signers[0])
          .transferFrom(ethers.ZeroAddress, ethers.ZeroAddress, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InvalidSender")
    })

    context("Recipient is ERC-721 transfer exempt", function () {
      it("Succeeds when transferring as ERC-20", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const from = f.signers[0]
        const to = f.signers[3]
        const value = (await f.contract.erc721TotalSupply()) + 1n

        // Confirm the sender holds sufficient balance.
        expect(await f.contract.erc20BalanceOf(from.address)).to.be.gte(value)

        await f.contract.setERC721TransferExempt(to.address, true)

        // Confirm that the 'to' address is ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(to.address)).to.equal(true)

        // Confirm that the 'from' address is not ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(from.address)).to.equal(
          false,
        )

        // 'from' has to grant themselves sufficient allowance to spend their own tokens using transferFrom
        await f.contract.connect(from).approve(from.address, value)

        // Attempt to send as ERC-20.
        return expect(
          f.contract
            .connect(from)
            .transferFrom(from.address, to.address, value),
        ).to.emit(f.contract, "Transfer")
      })

      it("Reverts when transferring as ERC-721", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const tokenId = f.deployConfig.idPrefix + 1n
        const from = f.signers[0]
        const to = f.signers[3]

        await f.contract
          .connect(f.signers[0])
          .setERC721TransferExempt(to.address, true)

        // Confirm that the 'to' address is ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(to.address)).to.equal(true)

        // Confirm that the 'from' address is not ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(from.address)).to.equal(
          false,
        )

        // Attempt to send 1 ERC-721.
        await expect(
          f.contract
            .connect(from)
            .transferFrom(from.address, to.address, tokenId),
        ).to.be.revertedWithCustomError(
          f.contract,
          "RecipientIsERC721TransferExempt",
        )
      })
    })

    context("Sender is ERC-721 transfer exempt", function () {
      it("Succeeds when transferring as ERC-20", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const from = f.signers[0]
        const to = f.signers[3]
        const value = (await f.contract.erc721TotalSupply()) + 1n

        // Confirm the sender holds sufficient balance.
        expect(await f.contract.erc20BalanceOf(from.address)).to.be.gte(value)

        await f.contract.setERC721TransferExempt(from.address, true)

        // Confirm that the 'to' address is not ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(to.address)).to.equal(
          false,
        )

        // Confirm that the 'from' address is ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(from.address)).to.equal(
          true,
        )

        // 'from' has to grant themselves sufficient allowance to spend their own tokens using transferFrom
        await f.contract.connect(from).approve(from.address, value)

        // Attempt to send as ERC-20.
        return expect(
          f.contract
            .connect(from)
            .transferFrom(from.address, to.address, value),
        ).to.emit(f.contract, "Transfer")
      })

      it("Reverts when transferring as ERC-721", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const tokenId = f.deployConfig.idPrefix + 1n
        const from = f.signers[0]
        const to = f.signers[3]

        await f.contract
          .connect(f.signers[0])
          .setERC721TransferExempt(from.address, true)

        // Confirm that the 'to' address is not ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(to.address)).to.equal(
          false,
        )

        // Confirm that the 'from' address is ERC-721 transfer exempt.
        expect(await f.contract.erc721TransferExempt(from.address)).to.equal(
          true,
        )

        // Attempt to send 1 ERC-721.
        await expect(
          f.contract
            .connect(from)
            .transferFrom(from.address, to.address, tokenId),
        ).to.be.revertedWithCustomError(f.contract, "Unauthorized")
      })
    })

    context(
      "Both sender and recipient are ERC-721 transfer exempt",
      function () {
        it("Succeeds when transferring as ERC-20", async function () {
          const f = await loadFixture(
            deployMinimalERC404WithERC20sAndERC721sMinted,
          )

          const from = f.signers[0]
          const to = f.signers[3]
          const value = (await f.contract.erc721TotalSupply()) + 1n

          // Confirm the sender holds sufficient balance.
          expect(await f.contract.erc20BalanceOf(from.address)).to.be.gte(value)

          await f.contract.setERC721TransferExempt(to.address, true)
          await f.contract.setERC721TransferExempt(from.address, true)

          // Confirm that the 'to' address is ERC-721 transfer exempt.
          expect(await f.contract.erc721TransferExempt(to.address)).to.equal(
            true,
          )

          // Confirm that the 'from' address is ERC-721 transfer exempt.
          expect(await f.contract.erc721TransferExempt(from.address)).to.equal(
            true,
          )

          // 'from' has to grant themselves sufficient allowance to spend their own tokens using transferFrom
          await f.contract.connect(from).approve(from.address, value)

          // Attempt to send as ERC-20.
          return expect(
            f.contract
              .connect(from)
              .transferFrom(from.address, to.address, value),
          ).to.emit(f.contract, "Transfer")
        })

        it("Reverts when transferring as ERC-721", async function () {
          const f = await loadFixture(
            deployMinimalERC404WithERC20sAndERC721sMinted,
          )

          const tokenId = f.deployConfig.idPrefix + 1n
          const from = f.signers[0]
          const to = f.signers[3]

          await f.contract
            .connect(f.signers[0])
            .setERC721TransferExempt(to.address, true)

          await f.contract
            .connect(f.signers[0])
            .setERC721TransferExempt(from.address, true)

          // Confirm that the 'to' address is ERC-721 transfer exempt.
          expect(await f.contract.erc721TransferExempt(to.address)).to.equal(
            true,
          )

          // Confirm that the 'from' address is ERC-721 transfer exempt.
          expect(await f.contract.erc721TransferExempt(from.address)).to.equal(
            true,
          )

          // Attempt to send 1 ERC-721.
          await expect(
            f.contract
              .connect(from)
              .transferFrom(from.address, to.address, tokenId),
          ).to.be.revertedWithCustomError(f.contract, "Unauthorized")
        })
      },
    )

    context("Operator owns the token to be moved", function () {
      // This test case proves that the operator cannot use transferFrom to transfer a token they own if they provide the wrong 'from' address.
      it("Reverts when attempting to transfer a token that operator owns, but that 'from' does not own", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const tokenId = f.deployConfig.idPrefix + 1n
        const operator = f.signers[0]
        const wrongFrom = f.signers[2]
        const to = f.signers[3]

        // Confirm that the target token exists, and that it has a non-0x0 owner.
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(
          ethers.ZeroAddress,
        )

        // Confirm that the operator owns the token.
        expect(await f.contract.ownerOf(tokenId)).to.equal(operator.address)

        // Confirm that the owner of the token is not the wrongFrom address.
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(
          wrongFrom.address,
        )

        // Confirm that to address does not own the token either.
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(to.address)

        // Attempt to send 1 ERC-721.
        await expect(
          f.contract
            .connect(operator)
            .transferFrom(wrongFrom.address, to.address, tokenId),
        ).to.be.revertedWithCustomError(f.contract, "Unauthorized")
      })

      it("Succeeds when transferring a token the operator owns, with the operator as 'from'", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const tokenId = f.deployConfig.idPrefix + 1n
        const operator = f.signers[0]
        const to = f.signers[3]

        // Confirm that the target token exists, and that it has a non-0x0 owner.
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(
          ethers.ZeroAddress,
        )

        // Confirm that the operator owns the token.
        expect(await f.contract.ownerOf(tokenId)).to.equal(operator.address)

        // Confirm that to address does not own the token either.
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(to.address)

        // console.log(await f.contract.owned(operator.address))

        // Attempt to send 1 ERC-721.
        await expect(
          f.contract
            .connect(operator)
            .transferFrom(operator.address, to.address, tokenId),
        ).not.to.be.reverted
      })
    })

    context("Operator does not own the token to be moved", function () {
      context("No approvals have been set", function () {
        it("Reverts when attempting to transfer a token that 'from' does not own", async function () {
          const f = await loadFixture(
            deployMinimalERC404WithERC20sAndERC721sMinted,
          )

          const operator = f.signers[1]
          const wrongFrom = f.signers[2]
          const to = f.signers[3]
          const tokenId = f.deployConfig.idPrefix + 1n

          // Confirm that the target token exists, and that it has a non-0x0 owner.
          expect(await f.contract.ownerOf(tokenId)).to.not.equal(
            ethers.ZeroAddress,
          )

          // Confirm that the operator owns the token.
          expect(await f.contract.ownerOf(tokenId)).to.not.equal(
            operator.address,
          )

          // Confirm that 'wrongFrom' does not own the token.
          expect(await f.contract.ownerOf(tokenId)).to.not.equal(
            wrongFrom.address,
          )

          // Confirm that 'to does not own the token.
          expect(await f.contract.ownerOf(tokenId)).to.not.equal(to.address)

          // Confirm that no approvals have been set.
          expect(await f.contract.getApproved(tokenId)).to.equal(
            ethers.ZeroAddress,
          )
          expect(
            await f.contract.isApprovedForAll(
              wrongFrom.address,
              operator.address,
            ),
          ).to.equal(false)

          // Attempt to send 1 ERC-721.
          await expect(
            f.contract
              .connect(operator)
              .transferFrom(wrongFrom.address, to.address, tokenId),
          ).to.be.revertedWithCustomError(f.contract, "Unauthorized")
        })
      })

      context(
        "Operator has been granted approval for all of 'from''s tokens",
        function () {
          it("Reverts when attempting to transfer a token that 'from' does not own", async function () {})

          it("Succeeds when transferring a token that 'from's owns", async function () {
            const f = await loadFixture(
              deployMinimalERC404WithERC20sAndERC721sMinted,
            )

            const tokenId = f.deployConfig.idPrefix + 1n
            const tokenOwner = f.signers[0]
            const operator = f.signers[2]
            const to = f.signers[3]

            // Confirm that the target token exists, and that it has a non-0x0 owner.
            expect(await f.contract.ownerOf(tokenId)).to.not.equal(
              ethers.ZeroAddress,
            )

            // Confirm that the operator does not own the token.
            expect(await f.contract.ownerOf(tokenId)).to.not.equal(
              operator.address,
            )

            // Confirm that to address does not own the token.
            expect(await f.contract.ownerOf(tokenId)).to.not.equal(to.address)

            // Confirm that the owner owns the token.
            expect(await f.contract.ownerOf(tokenId)).to.equal(
              tokenOwner.address,
            )

            // Approve the operator to move all of the owner's tokens.
            await f.contract
              .connect(tokenOwner)
              .setApprovalForAll(operator.address, true)

            // Confirm that the operator has been approved to move all of the owner's tokens.
            expect(
              await f.contract.isApprovedForAll(
                tokenOwner.address,
                operator.address,
              ),
            ).to.equal(true)

            // Confirm that the operator has not been approved to move the specific token (since we're testing setApprovalForAll).
            expect(await f.contract.getApproved(tokenId)).to.equal(
              ethers.ZeroAddress,
            )

            // Attempt to send 1 ERC-721.
            await expect(
              f.contract
                .connect(operator)
                .transferFrom(tokenOwner.address, to.address, tokenId),
            ).not.to.be.reverted
          })
        },
      )

      context(
        "Operator has been granted single token approval for a token",
        function () {
          context(
            "The approved token correctly belongs to 'from'",
            function () {
              it("Succeeds", async function () {
                const f = await loadFixture(
                  deployMinimalERC404WithERC20sAndERC721sMinted,
                )

                const tokenId = f.deployConfig.idPrefix + 1n
                const tokenOwner = f.signers[0]
                const operator = f.signers[2]
                const to = f.signers[3]

                // Confirm that the target token exists, and that it has a non-0x0 owner.
                expect(await f.contract.ownerOf(tokenId)).to.not.equal(
                  ethers.ZeroAddress,
                )

                // Confirm that the operator does not own the token.
                expect(await f.contract.ownerOf(tokenId)).to.not.equal(
                  operator.address,
                )

                // Confirm that to address does not own the token.
                expect(await f.contract.ownerOf(tokenId)).to.not.equal(
                  to.address,
                )

                // Confirm that the owner owns the token.
                expect(await f.contract.ownerOf(tokenId)).to.equal(
                  tokenOwner.address,
                )

                // Approve the operator to move the token.
                await f.contract
                  .connect(tokenOwner)
                  .approve(operator.address, tokenId)

                // Confirm that the operator has been approved to move the token.
                expect(await f.contract.getApproved(tokenId)).to.equal(
                  operator.address,
                )

                // Confirm that the operator has not been approved to move all of the owner's tokens.
                expect(
                  await f.contract.isApprovedForAll(
                    tokenOwner.address,
                    operator.address,
                  ),
                ).to.equal(false)

                // Attempt to send 1 ERC-721.
                await expect(
                  f.contract
                    .connect(operator)
                    .transferFrom(tokenOwner.address, to.address, tokenId),
                ).not.to.be.reverted
              })
            },
          )
        },
      )
    })
  })

  describe("#transfer", function () {
    it("Reverts when attempting to transfer anything to 0x0", async function () {
      const f = await loadFixture(deployERC404Example)

      // Attempt to send 1 ERC-721 to 0x0.
      await expect(
        f.contract.connect(f.signers[0]).transfer(ethers.ZeroAddress, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InvalidRecipient")

      // Attempt to send 1 full token worth of ERC-20s to 0x0
      await expect(
        f.contract
          .connect(f.signers[0])
          .transfer(ethers.ZeroAddress, f.deployConfig.units),
      ).to.be.revertedWithCustomError(f.contract, "InvalidRecipient")
    })

    it("Handles fractional balance changes on self-send correctly", async function () {
      const f = await loadFixture(deployERC404Example)

      // Send 1.5 tokens to address
      await f.contract
        .connect(f.signers[0])
        .transfer(f.signers[1].address, (15n * f.deployConfig.units) / 10n)

      // Send .5 tokens to self
      await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[1].address, (5n * f.deployConfig.units) / 10n)

      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.eq(1n)
      expect(await f.contract.erc20BalanceOf(f.signers[1].address)).to.eq(
        (15n * f.deployConfig.units) / 10n,
      )
    })

    it("Handles dequeue / enqueue correctly", async function () {
      const f = await loadFixture(deployERC404Example)

      // Send 4 tokens to address
      await f.contract
        .connect(f.signers[0])
        .transfer(f.signers[1].address, 4n * f.deployConfig.units)

      // Send 1 tokens to deployer
      await f.contract
       .connect(f.signers[1])
       .transfer(f.signers[0].address, 1n * f.deployConfig.units)

      expect(await f.contract.getERC721QueueLength()).to.eq(1)

      // Send 1 tokens to address
      await f.contract
        .connect(f.signers[0])
        .transfer(f.signers[1].address, 1n * f.deployConfig.units)

        expect(await f.contract.getERC721QueueLength()).to.eq(0)

      // Send 1 tokens to deployer
      await f.contract
       .connect(f.signers[1])
       .transfer(f.signers[0].address, 1n * f.deployConfig.units)

      expect(await f.contract.getERC721QueueLength()).to.eq(1)
    })
  })

  describe("#setERC721TransferExempt", function () {
    it("Allows the caller to exempt themselves", async function () {
      const f = await loadFixture(deployERC404Example)

      expect(
        await f.contract.erc721TransferExempt(f.randomAddresses[1]),
      ).to.equal(false)

      // Add a random address to the exemption list
      await f.contract.connect(f.signers[1]).setSelfERC721TransferExempt(true)
      expect(
        await f.contract.erc721TransferExempt(f.signers[1].address),
      ).to.equal(true)

      // Remove the random address from the exemption list
      await f.contract.connect(f.signers[1]).setSelfERC721TransferExempt(false)
      expect(
        await f.contract.erc721TransferExempt(f.signers[1].address),
      ).to.equal(false)
    })
  })

  describe("#_setERC721TransferExempt", function () {
    it("Allows the owner to add and remove addresses from the exemption list", async function () {
      const f = await loadFixture(deployERC404Example)

      expect(
        await f.contract.erc721TransferExempt(f.randomAddresses[1]),
      ).to.equal(false)

      // Add a random address to the exemption list
      await f.contract
        .connect(f.signers[0])
        .setERC721TransferExempt(f.randomAddresses[1], true)
      expect(
        await f.contract.erc721TransferExempt(f.randomAddresses[1]),
      ).to.equal(true)

      // Remove the random address from the exemption list
      await f.contract
        .connect(f.signers[0])
        .setERC721TransferExempt(f.randomAddresses[1], false)
      expect(
        await f.contract.erc721TransferExempt(f.randomAddresses[1]),
      ).to.equal(false)
    })

    it("Reverts when setting the zero address", async function () {
      const f = await loadFixture(deployERC404Example)

      await expect(
        f.contract
          .connect(f.signers[0])
          .setERC721TransferExempt(ethers.ZeroAddress, true),
      ).to.be.revertedWithCustomError(f.contract, "InvalidExemption")

      await expect(
        f.contract
          .connect(f.signers[0])
          .setERC721TransferExempt(ethers.ZeroAddress, false),
      ).to.be.revertedWithCustomError(f.contract, "InvalidExemption")
    })

    it("Rebalances ERC721 tokens held by the target", async function () {
      const f = await loadFixture(deployERC404Example)

      const targetAddress = f.randomAddresses[0]

      // Transfer 3.5 full NFT worth of tokens to that address.
      await f.contract
        .connect(f.signers[0])
        .transfer(targetAddress, (35n * f.deployConfig.units) / 10n)

      expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(3n)

      // Add that address to the exemption list.
      await f.contract
        .connect(f.signers[0])
        .setERC721TransferExempt(targetAddress, true)

      // Target ERC721 balance should be adjusted
      expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(0n)
      expect(await f.contract.getERC721QueueLength()).to.equal(3n)
      expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
        (35n * f.deployConfig.units) / 10n,
      )
      expect((await f.contract.getERC721TokensInQueue(0, 3))[0]).to.equal(
        f.deployConfig.idPrefix + 1n,
      )

      // Remove that address from the exemption list.
      await f.contract
        .connect(f.signers[0])
        .setERC721TransferExempt(targetAddress, false)

      // Target ERC721 balance should be adjusted
      expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(3n)
      expect(await f.contract.getERC721QueueLength()).to.equal(0n)
      expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
        (35n * f.deployConfig.units) / 10n,
      )
    })
  })

  describe("#erc721BalanceOf", function () {
    context("The address has 0.9 ERC-20 balance", function () {
      it("Returns the correct balance (0 ERC-721)", async function () {
        const f = await loadFixture(deployERC404Example)

        const targetAddress = f.randomAddresses[0]
        const transferAmount = (f.deployConfig.units / 10n) * 9n // 0.9 tokens

        // Transfer 1 full NFT worth of tokens to that address.
        await f.contract
          .connect(f.signers[0])
          .transfer(targetAddress, transferAmount)

        expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
          transferAmount,
        )
        expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(0n)
      })
    })

    context("The address has exactly 1.0 ERC-20 balance", function () {
      it("Returns the correct balance (1 ERC-721)", async function () {
        const f = await loadFixture(deployERC404Example)

        const targetAddress = f.randomAddresses[0]
        const transferAmount = f.deployConfig.units // 1.0 tokens

        // Transfer 1 full NFT worth of tokens to that address.
        await f.contract
          .connect(f.signers[0])
          .transfer(targetAddress, transferAmount)

        expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
          transferAmount,
        )
        expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(1n)
      })
    })

    context("The address has 1.1 ERC-20 balance", function () {
      it("Returns the correct balance (1 ERC-721)", async function () {
        const f = await loadFixture(deployERC404Example)

        const targetAddress = f.randomAddresses[0]
        const transferAmount = (f.deployConfig.units / 10n) * 9n // 0.9 tokens

        // Transfer 1 full NFT worth of tokens to that address.
        await f.contract
          .connect(f.signers[0])
          .transfer(targetAddress, transferAmount)

        expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
          transferAmount,
        )
        expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(0n)
      })
    })
  })

  describe("#erc20BalanceOf", function () {
    it("Returns the correct balance", async function () {
      const f = await loadFixture(deployERC404Example)

      const targetAddress = f.randomAddresses[0]
      const transferAmount = (f.deployConfig.units / 10n) * 9n // 0.9 tokens

      expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(0n)

      await f.contract
        .connect(f.signers[0])
        .transfer(targetAddress, transferAmount)

      expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
        transferAmount,
      )

      await f.contract
        .connect(f.signers[0])
        .transfer(targetAddress, transferAmount)

      expect(await f.contract.erc20BalanceOf(targetAddress)).to.equal(
        transferAmount * 2n,
      )
    })
  })

  describe("#minted", function () {
    it("Returns the total number of tokens minted for legacy support", async function () {
      const f = await loadFixture(
        deployERC404ExampleWithSomeTokensTransferredToRandomAddress,
      )

      expect(await f.contract.minted()).to.eq(5n)
    })
  })

  describe("#setApprovalForAll", function () {
    context(
      "Granting approval to a valid address besides themselves",
      function () {
        it("Allows a user to set an operator who has approval for all their ERC-721 tokens", async function () {
          const f = await loadFixture(deployERC404Example)

          const msgSender = f.signers[0]
          const intendedOperator = f.signers[1]

          expect(
            await f.contract.isApprovedForAll(
              msgSender.address,
              intendedOperator.address,
            ),
          ).to.equal(false)

          // Add an operator for msgSender
          const approveForAllTx = await f.contract
            .connect(msgSender)
            .setApprovalForAll(intendedOperator.address, true)

          expect(
            await f.contract.isApprovedForAll(
              msgSender.address,
              intendedOperator.address,
            ),
          ).to.equal(true)

          await expect(approveForAllTx)
            .to.emit(f.contract, "ApprovalForAll")
            .withArgs(f.signers[0].address, f.signers[1].address, true)
        })

        it("Allows a user to remove an operator's approval for all", async function () {
          const f = await loadFixture(deployERC404Example)

          const msgSender = f.signers[0]
          const intendedOperator = f.signers[1]

          // Add an operator for msgSender
          await f.contract
            .connect(msgSender)
            .setApprovalForAll(intendedOperator.address, true)

          // Remove the operator
          await f.contract
            .connect(msgSender)
            .setApprovalForAll(intendedOperator.address, false)

          expect(
            await f.contract.isApprovedForAll(
              msgSender.address,
              intendedOperator.address,
            ),
          ).to.equal(false)
        })
      },
    )

    context("Granting approval to themselves", function () {
      it("Allows a user to set themselves as an operator who has approval for all their ERC-721 tokens", async function () {
        const f = await loadFixture(deployERC404Example)

        const msgSender = f.signers[0]

        expect(
          await f.contract.isApprovedForAll(
            msgSender.address,
            msgSender.address,
          ),
        ).to.equal(false)

        // Add an operator for msgSender
        await f.contract
          .connect(msgSender)
          .setApprovalForAll(msgSender.address, true)

        expect(
          await f.contract.isApprovedForAll(
            msgSender.address,
            msgSender.address,
          ),
        ).to.equal(true)
      })

      it("Allows a user to remove their own approval for all", async function () {
        const f = await loadFixture(deployERC404Example)

        const msgSender = f.signers[0]

        // Add an operator for msgSender
        await f.contract
          .connect(msgSender)
          .setApprovalForAll(msgSender.address, true)

        // Remove the operator
        await f.contract
          .connect(msgSender)
          .setApprovalForAll(msgSender.address, false)

        expect(
          await f.contract.isApprovedForAll(
            msgSender.address,
            msgSender.address,
          ),
        ).to.equal(false)
      })
    })

    context("Granting approval to 0x0", function () {
      it("Reverts if the user attempts to grant or revoke approval for all to 0x0", async function () {
        const f = await loadFixture(deployERC404Example)

        const msgSender = f.signers[0]

        await expect(
          f.contract
            .connect(msgSender)
            .setApprovalForAll(ethers.ZeroAddress, true),
        ).to.be.revertedWithCustomError(f.contract, "InvalidOperator")

        await expect(
          f.contract
            .connect(msgSender)
            .setApprovalForAll(ethers.ZeroAddress, false),
        ).to.be.revertedWithCustomError(f.contract, "InvalidOperator")
      })
    })
  })

  describe("#permit", function () {
    context(
      "Permitting tokens in the valid ERC-721 token id range",
      function () {
        it("Reverts", async function () {
          const f = await loadFixture(
            deployMinimalERC404WithERC20sAndERC721sMinted,
          )

          const msgSender = f.signers[0]
          const spender = f.signers[1]

          // Confirm that the token is owned by the grantor
          expect(
            await f.contract.ownerOf(f.deployConfig.idPrefix + 1n),
          ).to.equal(msgSender.address)

          const validSig = await getPermitSignature(
            f.contractAddress,
            msgSender,
            spender.address,
            // This is the highest valid ERC-20 value that can be approved (besides MAX_INT).
            f.deployConfig.idPrefix,
            0n,
            1000000000000000000n,
          )

          await expect(
            f.contract
              .connect(msgSender)
              .permit(
                msgSender,
                spender,
                f.deployConfig.idPrefix,
                1000000000000000000n,
                validSig.v,
                validSig.r,
                validSig.s,
              ),
          ).not.to.be.reverted

          const invalidSig1 = await getPermitSignature(
            f.contractAddress,
            msgSender,
            spender.address,
            // This enters into ERC-721 token id territory.
            f.deployConfig.idPrefix + 1n,
            0n,
            1000000000000000000n,
          )

          await expect(
            f.contract
              .connect(msgSender)
              .permit(
                msgSender,
                spender,
                f.deployConfig.idPrefix + 1n,
                1000000000000000000n,
                invalidSig1.v,
                invalidSig1.r,
                invalidSig1.s,
              ),
          ).to.be.revertedWithCustomError(f.contract, "InvalidApproval")
        })
      },
    )

    context("Permitting ERC-20 tokens", function () {
      it("Should revert when 0x0 spender", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]

        // Confirm that from has valid balance
        expect(await f.contract.balanceOf(msgSender.address)).to.be.greaterThan(
          f.deployConfig.units,
        )

        const sig = await getPermitSignature(
          f.contractAddress,
          msgSender,
          ethers.ZeroAddress,
          f.deployConfig.units,
          0n,
          1000000000000000000n,
        )

        await expect(
          f.contract
            .connect(msgSender)
            .permit(
              msgSender,
              ethers.ZeroAddress,
              f.deployConfig.units,
              1000000000000000000n,
              sig.v,
              sig.r,
              sig.s,
            ),
        ).to.be.revertedWithCustomError(f.contract, "InvalidSpender")
      })

      it("Should revert when deadline expired", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const spender = f.signers[1]

        // Confirm that from has valid balance
        expect(await f.contract.balanceOf(msgSender.address)).to.be.greaterThan(
          f.deployConfig.units,
        )

        const sig = await getPermitSignature(
          f.contractAddress,
          msgSender,
          spender.address,
          1n,
          0n,
          0n,
        )

        await expect(
          f.contract
            .connect(msgSender)
            .permit(
              msgSender,
              spender,
              f.deployConfig.units,
              0n,
              sig.v,
              sig.r,
              sig.s,
            ),
        ).to.be.revertedWithCustomError(f.contract, "PermitDeadlineExpired")
      })

      it("Should set approval under valid conditions", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const spender = f.signers[1]

        // Confirm that from has valid balance
        expect(await f.contract.balanceOf(msgSender.address)).to.be.greaterThan(
          f.deployConfig.units,
        )

        const sig = await getPermitSignature(
          f.contractAddress,
          msgSender,
          spender.address,
          57896044618658097711785492504343953926634992332820282019728792003956564819967n,
          0n,
          1000000000000000000n,
        )

        const permitTx = await f.contract
          .connect(spender)
          .permit(
            msgSender,
            spender,
            57896044618658097711785492504343953926634992332820282019728792003956564819967n,
            1000000000000000000n,
            sig.v,
            sig.r,
            sig.s,
          )

        expect(
          await f.contract.allowance(msgSender.address, spender.address),
        ).to.eq(
          57896044618658097711785492504343953926634992332820282019728792003956564819967n,
        )

        await expect(permitTx)
          .to.emit(f.contract, "Approval")
          .withArgs(
            f.signers[0].address,
            f.signers[1].address,
            57896044618658097711785492504343953926634992332820282019728792003956564819967n,
          )
      })
    })
  })

  describe("#approve", function () {
    context("Granting approval for ERC-721 tokens", function () {
      it("Allows a token owner to grant specific ERC-721 token approval to an operator", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const intendedOperator = f.signers[1]

        // Confirm that the token is owned by the grantor
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + 1n)).to.equal(
          msgSender.address,
        )

        // Add an operator for msgSender
        const erc721ApprovalTx = await f.contract
          .connect(msgSender)
          .approve(intendedOperator.address, f.deployConfig.idPrefix + 1n)

        const isApproved = await f.contract.getApproved(
          f.deployConfig.idPrefix + 1n,
        )

        expect(isApproved).to.equal(intendedOperator.address)

        // Confirm that a corresponding ERC-20 approval for the ERC-721 token was not set.
        expect(
          await f.contract.allowance(
            msgSender.address,
            intendedOperator.address,
          ),
        ).to.equal(0n)

        await expect(
          containsERC721ApprovalEvent(
            (await erc721ApprovalTx.wait()).logs,
            f.signers[0].address,
            f.signers[1].address,
            f.deployConfig.idPrefix + 1n,
          ),
        ).to.eq(true)
      })

      it("Allows a token owner to revoke specific ERC-721 token approval from an operator", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const intendedOperator = f.signers[1]

        // Confirm that the token is owned by the grantor
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + 1n)).to.equal(
          msgSender.address,
        )

        // Add an operator for msgSender
        await f.contract
          .connect(msgSender)
          .approve(intendedOperator.address, f.deployConfig.idPrefix + 1n)

        let isApproved = await f.contract.getApproved(
          f.deployConfig.idPrefix + 1n,
        )

        expect(isApproved).to.equal(intendedOperator.address)

        // Remove the operator
        await f.contract
          .connect(msgSender)
          .approve(ethers.ZeroAddress, f.deployConfig.idPrefix + 1n)

        isApproved = await f.contract.getApproved(f.deployConfig.idPrefix + 1n)

        expect(isApproved).to.equal(ethers.ZeroAddress)
      })

      it("Reverts if the user attempts to grant approval for a token they don't own", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const tokenId = f.deployConfig.idPrefix + 1n
        const tokenOwner = f.signers[0]
        const wrongOwner = f.signers[1]
        const operator = f.signers[2]

        // Confirm that the token is not owned by operator
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(operator.address)

        // Confirm that the token is owned by tokenOwner
        expect(await f.contract.ownerOf(tokenId)).to.equal(tokenOwner.address)

        // Confirm that wrongOwner does not own the token.
        expect(await f.contract.ownerOf(tokenId)).to.not.equal(
          wrongOwner.address,
        )

        // Attempt to approve an operator for a token that the grantor does not own.
        await expect(
          f.contract.connect(wrongOwner).approve(operator.address, tokenId),
        ).to.be.revertedWithCustomError(f.contract, "Unauthorized")
      })

      context(
        "Having already granted approval for all to a valid address",
        function () {
          it("Allows an approved operator to grant specific approval for any ERC-721 token owned by the grantor", async function () {
            const f = await loadFixture(
              deployMinimalERC404ForHavingAlreadyGrantedApprovalForAllTests,
            )

            // Confirm that the token is owned by the grantor
            expect(
              await f.contract.ownerOf(f.deployConfig.idPrefix + 1n),
            ).to.equal(f.msgSender.address)

            // Approve the operator to transfer the token
            await f.contract
              .connect(f.intendedOperator)
              .approve(f.secondOperator.address, f.deployConfig.idPrefix + 1n)

            expect(
              await f.contract.getApproved(f.deployConfig.idPrefix + 1n),
            ).to.equal(f.secondOperator.address)
          })
        },
      )
    })

    context("Granting approval for ERC-20 tokens", function () {
      it("Allows a user to grant an operator an ERC-20 token allowance", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const intendedOperator = f.signers[1]

        // Check that the initial allowance is 0
        expect(
          await f.contract.allowance(
            msgSender.address,
            intendedOperator.address,
          ),
        ).to.equal(0n)

        const allowanceToSet = 1n

        // Set an allowance. Must be greater than minted to be considered an ERC-20 allowance.
        const erc20ApprovalTx = await f.contract
          .connect(msgSender)
          .approve(intendedOperator.address, allowanceToSet)

        expect(
          await f.contract.allowance(
            msgSender.address,
            intendedOperator.address,
          ),
        ).to.equal(allowanceToSet)

        // Confirm that a corresponding ERC-721 approval for the allowanceToSet value was not set.
        expect(await f.contract.getApproved(allowanceToSet)).to.equal(
          ethers.ZeroAddress,
        )

        await expect(erc20ApprovalTx)
          .to.emit(f.contract, "Approval")
          .withArgs(f.signers[0].address, f.signers[1].address, allowanceToSet)
      })

      it("Allows a user to grant an operator a max ERC-20 token allowance", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const intendedOperator = f.signers[1]

        // Check that the initial allowance is 0
        expect(
          await f.contract.allowance(
            msgSender.address,
            intendedOperator.address,
          ),
        ).to.equal(0n)

        const allowanceToSet =
          57896044618658097711785492504343953926634992332820282019728792003956564819967n

        // Set an allowance. Must be greater than minted to be considered an ERC-20 allowance.
        const erc20ApprovalTx = await f.contract
          .connect(msgSender)
          .approve(intendedOperator.address, allowanceToSet)

        expect(
          await f.contract.allowance(
            msgSender.address,
            intendedOperator.address,
          ),
        ).to.equal(allowanceToSet)

        // Confirm that a corresponding ERC-721 approval for the allowanceToSet value was not set.
        expect(await f.contract.getApproved(allowanceToSet)).to.equal(
          ethers.ZeroAddress,
        )

        await expect(erc20ApprovalTx)
          .to.emit(f.contract, "Approval")
          .withArgs(f.signers[0].address, f.signers[1].address, allowanceToSet)
      })

      it("Reverts if a user attempts to grant 0x0 an ERC-20 token allowance", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]

        // Get the current minted number of ERC-721 tokens.
        const minted = await f.contract.erc721TotalSupply()

        const allowanceToSet = minted + 1n

        await expect(
          f.contract
            .connect(msgSender)
            .approve(ethers.ZeroAddress, allowanceToSet),
        ).to.be.revertedWithCustomError(f.contract, "InvalidSpender")
      })
    })
  })

  describe("E2E tests", function () {
    it("Minting out the full supply, making ERC-20 and ERC-721 transfers, banking and retrieving tokens", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Initial minting. Will mint ERC-20 and ERC-721 tokens.
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
        )

      // Expect the minted count to be equal to the max total supply
      expect(await f.contract.erc721TotalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )

      // Expect the total supply to be equal to the max total supply
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )

      await f.contract.connect(f.signers[0]).mintERC20(f.signers[1].address, 1n)

      // Expect the mint recipient to have the full supply of ERC20 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[1].address)).to.equal(
        f.deployConfig.maxTotalSupplyERC20 + 1n,
      )

      // Expect the mint recipient to have the full supply of ERC721 tokens (tokens 1-100)
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )

      // Expect the mint recipient to be the owner of token ids 1-100.
      for (let i = 1n; i <= 100n; i++) {
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + i)).to.equal(
          f.signers[1].address,
        )
      }

      // Transfer 5 full tokens as ERC-20 from the mint recipient to another address (not exempted) (tokens 95-100)
      await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, 5n * f.deployConfig.units)

      // Expect the sender to have 5 * units ERC-20 tokens and 5 ERC-721 tokens less
      expect(await f.contract.erc20BalanceOf(f.signers[1].address)).to.equal(
        f.deployConfig.maxTotalSupplyERC20 - 5n * f.deployConfig.units + 1n,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        f.deployConfig.maxTotalSupplyERC721 - 5n,
      )

      // Expect the sender to be the owner of token ids 1-95.
      for (let i = 1n; i <= 95n; i++) {
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + i)).to.equal(
          f.signers[1].address,
        )
      }

      // Expect the recipient to have 5 * units ERC-20 tokens and 5 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        5n * f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        5n,
      )

      // Expect the recipient to be the owner of token ids 96-100.
      for (let i = 96n; i <= 100n; i++) {
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + i)).to.equal(
          f.signers[2].address,
        )
      }

      // Transfer a fraction of a token to another address to break apart a full NFT.
      const fractionalValueToTransferERC20T1 = f.deployConfig.units / 10n // 0.1 tokens
      await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[3].address, fractionalValueToTransferERC20T1)

      // Expect the recipient to have 0.1 * units ERC-20 tokens and 0 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[3].address)).to.equal(
        fractionalValueToTransferERC20T1,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[3].address)).to.equal(
        0n,
      )

      // Expect the sender to have 4.9 * units ERC-20 tokens and 4 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        5n * f.deployConfig.units - fractionalValueToTransferERC20T1,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        4n,
      )

      // Expect that the sender holds token ids 97-99 (96 popped off)
      for (let i = 97n; i <= 99n; i++) {
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + i)).to.equal(
          f.signers[2].address,
        )
      }

      // Expect the contract to have 0 ERC-721 token
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)
      // Expect the contract to hold token id 96
      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 96n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      // The sender has 4.9 tokens now. Transfer 0.9 tokens to a different address, leaving 4 tokens. This should not break apart any new tokens. The contract hsould still hold 1, the sender should hold 4 and 4 NFTs, and the new receiver should hold 0.9 and no NFTs
      const fractionalValueToTransferERC20T2 = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
      await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[4].address, fractionalValueToTransferERC20T2)

      // Expect the recipient to have 0.9 * units ERC-20 tokens and 0 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[4].address)).to.equal(
        fractionalValueToTransferERC20T2,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[4].address)).to.equal(
        0n,
      )

      // Expect the sender to have 4 * units ERC-20 tokens and 4 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        4n * f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        4n,
      )

      // Break apart another full token so the contract holds 2 (to test the FIFO queue)
      // Transfer 0.1 tokens to the contract from the same sender, so he now has 3.9 tokens and 3 NFTs, and the contract has 2 NFTs.
      const fractionalValueToTransferERC20T3 = f.deployConfig.units / 10n // 0.1 tokens

      await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[5], fractionalValueToTransferERC20T3)

      // Expect the recipient to have 0.1 * units ERC-20 tokens and 0 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[5].address)).to.equal(
        fractionalValueToTransferERC20T3,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[5].address)).to.equal(
        0n,
      )

      // Expect the sender to have 3.9 * units ERC-20 tokens and 3 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        3n * f.deployConfig.units + fractionalValueToTransferERC20T2,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        3n,
      )
      // Expect the sender to hold token ids 98-100
      for (let i = 98n; i <= 100n; i++) {
        expect(await f.contract.ownerOf(f.deployConfig.idPrefix + i)).to.equal(
          f.signers[2].address,
        )
      }

      // Expect the contract still hold 0 tokens
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)

      // Expect token 96 and 97 to be owned by the zero address
      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 96n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 97n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      // Transfer two full tokens to a new address, leaving the sender with 1.9 tokens and 1 NFT, the new recipient with 2 tokens and 2 NFTs, and the contract with 0 tokens and 2 NFTs.
      await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[6].address, 2n * f.deployConfig.units)

      // Expect the recipient to have 2 * units ERC-20 tokens and 2 ERC-721 tokens
      expect(await f.contract.erc20BalanceOf(f.signers[6].address)).to.equal(
        2n * f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[6].address)).to.equal(
        2n,
      )

      // Expect the recipient to hold token ids 98 and 99

      // Expect the sender to have 1.9 * units ERC-20 tokens and 1 ERC-721 token
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        1n * f.deployConfig.units + fractionalValueToTransferERC20T2,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        1n,
      )

      // Expect the sender to hold token id 100
      expect(await f.contract.ownerOf(f.deployConfig.idPrefix + 100n)).to.equal(
        f.signers[2].address,
      )

      // Expect tokens 96 and 97 to still be owned by the zero address
      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 96n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 97n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")

      // Transfer 0.9 ERC-20s (enough ERC-20 tokens for signer 5 to gain a full token), leaving the sender with 1.0 tokens and 1 NFT, the new recipient with 1 ERC-20 and 1 ERC-721, and the contract with 0 tokens and 1 NFTs.
      // Transfer 0.9 tokens to the recipient
      const fractionalValueToTransferERC20T4 = (f.deployConfig.units / 10n) * 9n

      // The sender should hold 1.9 tokens and 1 NFT
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        1n * f.deployConfig.units + fractionalValueToTransferERC20T2,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        1n,
      )

      // The recipient should still hold 0.1 tokens and no NFTs.
      expect(await f.contract.erc20BalanceOf(f.signers[5].address)).to.equal(
        fractionalValueToTransferERC20T3,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[5].address)).to.equal(
        0n,
      )

      // Transfer 0.9 tokens to the recipient
      await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[5].address, fractionalValueToTransferERC20T4)

      // Expect the recipient to have 1 * units ERC-20 tokens and 1 ERC-721 token
      expect(await f.contract.erc20BalanceOf(f.signers[5].address)).to.equal(
        f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[5].address)).to.equal(
        1n,
      )

      // Expect the recipient to hold token id 96 (96 was added to the queue first, so it should be the first to be removed)
      expect(await f.contract.ownerOf(f.deployConfig.idPrefix + 96n)).to.equal(
        f.signers[5].address,
      )

      // Expect the sender to have 1 * units ERC-20 tokens and 1 ERC-721 token
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        1n * f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        1n,
      )

      // Expect the sender to hold token id 100
      expect(await f.contract.ownerOf(f.deployConfig.idPrefix + 100n)).to.equal(
        f.signers[2].address,
      )

      // Expect the zero address to still hold token id 97
      await expect(
        f.contract.ownerOf(f.deployConfig.idPrefix + 97n),
      ).to.be.revertedWithCustomError(f.contract, "NotFound")
    })

    it("Various weird scenarios where addresses are added and removed from the ERC-721 transfer exempt list", async function () {
      // TODO
    })
  })

  describe("#_mintERC20", function () {
    it("Mints on partial balances", async function () {
      const f = await loadFixture(deployMinimalERC404)

      await f.contract.mintERC20(
        f.signers[1].address,
        (5n * f.deployConfig.units) / 10n,
      )

      expect(await f.contract.balanceOf(f.signers[1].address)).to.eq(
        (5n * f.deployConfig.units) / 10n,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.eq(0)

      await f.contract.mintERC20(
        f.signers[1].address,
        (5n * f.deployConfig.units) / 10n,
      )

      expect(await f.contract.balanceOf(f.signers[1].address)).to.eq(
        f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.eq(1)
    })
  })

  describe("#_retrieveOrMintERC721", function () {
    context("When the contract has no tokens in the queue", function () {
      context("Contract ERC-721 balance is 0", async function () {
        it("Mints a new full ERC-20 token + corresponding ERC-721 token", async function () {
          const f = await loadFixture(deployMinimalERC404)

          // Expect the contract to have no ERC-721 tokens
          expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(
            0n,
          )
          expect(await f.contract.getERC721QueueLength()).to.equal(0n)

          expect(await f.contract.erc721TotalSupply()).to.equal(0n)

          // Mint a new full ERC-20 token + corresponding ERC-721 token
          await f.contract.mintERC20(f.signers[0].address, f.deployConfig.units)

          expect(await f.contract.erc721TotalSupply()).to.equal(1n)
        })
      })

      context("Contract ERC-721 balance is > 0", async function () {
        it("Mints a new full ERC-20 token + corresponding ERC-721 token", async function () {
          const f = await loadFixture(deployMinimalERC404)

          // Expect the contract to have no ERC-721 tokens
          expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(
            0n,
          )
          expect(await f.contract.getERC721QueueLength()).to.equal(0n)

          expect(await f.contract.erc721TotalSupply()).to.equal(0n)

          // Mint a new full ERC-20 token + corresponding ERC-721 token
          await f.contract.mintERC20(f.signers[0].address, f.deployConfig.units)

          expect(await f.contract.erc721TotalSupply()).to.equal(1n)

          // Transfer the factional token to the contract
          await f.contract
            .connect(f.signers[0])
            .transferFrom(
              f.signers[0].address,
              f.contractAddress,
              f.deployConfig.idPrefix + 1n,
            )

          // Expect the contract to have 0 ERC-721 token
          expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(
            1n,
          )

          // Expect the contract to have 0 ERC-721 token in the queue
          expect(await f.contract.getERC721QueueLength()).to.equal(0n)

          // Expect the contract to own token 1
          expect(
            await f.contract.ownerOf(f.deployConfig.idPrefix + 1n),
          ).to.equal(f.contractAddress)

          // Mint a new full ERC-20 token + corresponding ERC-721 token
          await f.contract.mintERC20(f.signers[0].address, f.deployConfig.units)

          expect(await f.contract.erc721TotalSupply()).to.equal(2n)

          // Expect the contract to still own token 1
          expect(
            await f.contract.ownerOf(f.deployConfig.idPrefix + 1n),
          ).to.equal(f.contractAddress)

          // Expect the mint recipient to have have a balance of 1 ERC-721 token
          expect(
            await f.contract.erc721BalanceOf(f.signers[0].address),
          ).to.equal(1n)

          // Expect the contract to have an ERC-20 balance of 1 full token
          expect(
            await f.contract.erc20BalanceOf(f.signers[0].address),
          ).to.equal(f.deployConfig.units)

          // Expect the mint recipient to be the owner of token 2
          expect(
            await f.contract.ownerOf(f.deployConfig.idPrefix + 2n),
          ).to.equal(f.signers[0].address)
        })
      })
    })
  })
})
