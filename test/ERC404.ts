import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers, network } from "hardhat"

describe("ERC404", function () {
  async function deployExampleERC404() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("ExampleERC404")

    const name = "Example"
    const symbol = "EXM"
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
    deadline: bigint
  ) {
    const domain = {
      name: "Example",
      version: "1",
      chainId: network.config.chainId as number,
      verifyingContract: contractAddress
    }
  
    const types = {
      Permit: [{
          name: "owner",
          type: "address"
        },
        {
          name: "spender",
          type: "address"
        },
        {
          name: "value",
          type: "uint256"
        },
        {
          name: "nonce",
          type: "uint256"
        },
        {
          name: "deadline",
          type: "uint256"
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
    const symbol = "EXM"
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
        true,
      )

    return f
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

  async function deployExampleERC404WithTokensInSecondSigner() {
    const f = await loadFixture(deployExampleERC404)
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

    // Add the owner to the whitelist
    await f.contract
      .connect(f.signers[0])
      .setWhitelist(f.signers[0].address, true)

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

  async function deployExampleERC404WithSomeTokensTransferredToRandomAddress() {
    const f = await loadFixture(deployExampleERC404)

    const targetAddress = f.randomAddresses[0]

    // Transfer some tokens to a non-whitelisted wallet to generate the NFTs.
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

  describe("#constructor", function () {
    it("Initializes the contract with the expected values", async function () {
      const f = await loadFixture(deployExampleERC404)

      expect(await f.contract.name()).to.equal(f.deployConfig.name)
      expect(await f.contract.symbol()).to.equal(f.deployConfig.symbol)
      expect(await f.contract.decimals()).to.equal(f.deployConfig.decimals)
      expect(await f.contract.owner()).to.equal(
        f.deployConfig.initialOwner.address,
      )
    })

    it("Mints the initial supply of tokens to the initial mint recipient", async function () {
      const f = await loadFixture(deployExampleERC404)

      // Expect full supply of ERC20 tokens to be minted to the initial recipient.
      expect(
        await f.contract.erc20BalanceOf(
          f.deployConfig.initialMintRecipient.address,
        ),
      ).to.equal(f.deployConfig.maxTotalSupplyERC20)
      // Expect 0 ERC721 tokens to be minted to the initial recipient, since 1) the user is on the whitelist and 2) the supply is minted using _mintERC20 with mintCorrespondingERC721s_ set to false.
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

    it("Initializes the whitelist with the initial mint recipient", async function () {
      const f = await loadFixture(deployExampleERC404)

      expect(
        await f.contract.whitelist(f.deployConfig.initialMintRecipient.address),
      ).to.equal(true)
    })
  })

  describe("#erc20TotalSupply", function () {
    it("Returns the correct total supply", async function () {
      const f = await loadFixture(
        deployExampleERC404WithSomeTokensTransferredToRandomAddress,
      )

      expect(await f.contract.erc20TotalSupply()).to.eq(100n * f.deployConfig.units);
    })
  })

  describe("#erc721TotalSupply", function () {
    it("Returns the correct total supply", async function () {
      const f = await loadFixture(
        deployExampleERC404WithSomeTokensTransferredToRandomAddress,
      )

      expect(await f.contract.erc721TotalSupply()).to.eq(5n);
    })
  })

  describe("#ownerOf", function () {
    context("Some tokens have been minted", function () {
      it("Reverts if the token ID does not exist", async function () {
        const f = await loadFixture(
          deployExampleERC404WithSomeTokensTransferredToRandomAddress,
        )

        await expect(f.contract.ownerOf(11n)).to.be.revertedWithCustomError(
          f.contract,
          "NotFound",
        )
      })

      it("Reverts if the token ID is 0", async function () {
        const f = await loadFixture(
          deployExampleERC404WithSomeTokensTransferredToRandomAddress,
        )

        await expect(f.contract.ownerOf(0n)).to.be.revertedWithCustomError(
          f.contract,
          "NotFound",
        )
      })

      it("Returns the address of the owner of the token", async function () {
        const f = await loadFixture(
          deployExampleERC404WithSomeTokensTransferredToRandomAddress,
        )

        // Transferred 5 full tokens from a whitelisted address to the target address (not whitelisted), which minted the first 5 NFTs.

        // Expect the owner of the token to be the recipient
        for (let i = 1n; i <= 5n; i++) {
          expect(await f.contract.ownerOf(i)).to.equal(f.targetAddress)
        }
      })
    })
  })

  describe("Enforcement of max total supply limits", function () {
    it("Allows minting of the full supply of ERC20 + ERC721 tokens", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          true,
        )

      // Expect the minted count to be equal to the max total supply
      expect(await f.contract.erc721TotalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )
    })

    it("Allows minting of the full supply of ERC20 tokens only", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          false,
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

      // Expect the contract's bank to be empty
      // TODO: for now we can only check the minted count as the balance is not updated for the contract.
      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      const nftQty = 10n
      const value = nftQty * f.deployConfig.units

      // Mint 10 ERC721s
      const mintTx = await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, value, true)

      // Check for ERC721Transfer mint events (from 0x0 to the recipient)
      for (let i = 1n; i <= nftQty; i++) {
        await expect(mintTx)
          .to.emit(f.contract, "ERC721Transfer")
          .withArgs(ethers.ZeroAddress, f.signers[1].address, i)
      }

      // Check for ERC20Transfer mint events (from 0x0 to the recipient)
      await expect(mintTx)
        .to.emit(f.contract, "ERC20Transfer")
        .withArgs(ethers.ZeroAddress, f.signers[1].address, value)

      // 10 NFTs should have been minted
      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // Expect
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        10n,
      )
    })

    it("Stores ERC721s in contract's bank when a sender loses a full token", async function () {
      const f = await loadFixture(deployMinimalERC404)

      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      const nftQty = 10n
      const value = nftQty * f.deployConfig.units

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, value, true)

      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)

      // Move a fraction of a token to another address to break apart a full NFT.

      const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens
      const fractionalTransferTx = await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, fractionalValueToTransferERC20)

      await expect(fractionalTransferTx)
        .to.emit(f.contract, "ERC20Transfer")
        .withArgs(
          f.signers[1].address,
          f.signers[2].address,
          fractionalValueToTransferERC20,
        )

      // Expect token id 10 to be transferred to the contract's address (popping the last NFT from the sender's stack)
      await expect(fractionalTransferTx)
        .to.emit(f.contract, "ERC721Transfer")
        .withArgs(f.signers[1].address, ethers.ZeroAddress, 10n)

      // 10 tokens still minted, nothing changes there.
      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // The owner of NFT 10 should be the contract's address
      await expect(f.contract.ownerOf(10n)).to.be.revertedWithCustomError(f.contract, "NotFound")

      // The sender's NFT balance should be 9
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        9n,
      )
    })

    it("Retrieves ERC721s from the contract's bank when the contract's bank holds NFTs and the user regains a full token", async function () {
      const f = await loadFixture(deployMinimalERC404)

      expect(await f.contract.erc721TotalSupply()).to.equal(0n)

      const nftQty = 10n
      const erc20Value = nftQty * f.deployConfig.units

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, erc20Value, true)

      expect(await f.contract.erc721TotalSupply()).to.equal(10n)

      // Move a fraction of a token to another address to break apart a full NFT.
      const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens

      await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, fractionalValueToTransferERC20)

      // The owner of NFT 10 should be the contract's address
      await expect(f.contract.ownerOf(10n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )

      // The sender's NFT balance should be 9
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        9n,
      )

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)

      // Transfer the fractional portion needed to regain a full token back to the original sender
      const regainFullTokenTx = await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[1].address, fractionalValueToTransferERC20)

      expect(regainFullTokenTx)
        .to.emit(f.contract, "ERC20Transfer")
        .withArgs(
          f.signers[2].address,
          f.signers[1].address,
          fractionalValueToTransferERC20,
        )
      expect(regainFullTokenTx)
        .to.emit(f.contract, "ERC721Transfer")
        .withArgs(ethers.ZeroAddress, f.signers[1].address, 9n)

      // Original sender's ERC20 balance should be 10 * units
      expect(await f.contract.erc20BalanceOf(f.signers[1].address)).to.equal(
        erc20Value,
      )

      // The owner of NFT 9 should be the original sender's address
      expect(await f.contract.ownerOf(10n)).to.equal(f.signers[1].address)

      // The sender's NFT balance should be 10
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        10n,
      )

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)
    })
  })

  describe("ERC20 token transfer logic for triggering ERC721 transfers", function () {
    context(
      "Fractional transfers (moving less than 1 full token) that trigger ERC721 transfers",
      async function () {
        it("Handles the case of the receiver gaining a whole new token", async function () {
          const f = await loadFixture(
            deployExampleERC404WithTokensInSecondSigner,
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
            deployExampleERC404WithTokensInSecondSigner,
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
        const f = await loadFixture(deployExampleERC404WithTokensInSecondSigner)

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

        const f = await loadFixture(deployExampleERC404WithTokensInSecondSigner)

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

  describe("#transferFrom", function () {
    it("Doesn't allow anyone to transfer from 0x0", async function () {
      const f = await loadFixture(deployExampleERC404)

      // Attempt to transfer from 0x0. This will always fail as it's not possible for the 0x0 address to sign a transaction, so it can neither send a transfer nor give another address an allowance.
      await expect(
        f.contract
          .connect(f.signers[0])
          .transferFrom(ethers.ZeroAddress, f.signers[1].address, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InvalidSender")
    })

    it("Reverts when attempting to transfer a token the operator does not own", async function () {
      const f = await loadFixture(deployMinimalERC404WithERC20sAndERC721sMinted)

      const operator = f.signers[1]

      // Confirm that the target token exists, and that it has a non-0x0 owner.
      expect(await f.contract.ownerOf(1n)).to.not.equal(ethers.ZeroAddress)

      // Confirm that the owner is not the operator we're going to use for the test.
      expect(await f.contract.ownerOf(1n)).to.not.equal(operator.address)

      // Attempt to send 1 ERC-721 to another address from a signer who doesn't own it.
      await expect(
        f.contract.connect(operator).transferFrom(operator.address, f.signers[3].address, 1n),
      ).to.be.revertedWithCustomError(f.contract, "Unauthorized")
    })

    // TODO More tests needed here, including testing that approvals work.
  })

  describe("#transfer", function () {
    it("Reverts when attempting to transfer anything to 0x0", async function () {
      const f = await loadFixture(deployExampleERC404)

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

    // TODO more tests needed here, including testing that approvals work.
  })

  describe("#_setWhitelist", function () {
    it("Allows the owner to add and remove addresses from the whitelist", async function () {
      const f = await loadFixture(deployExampleERC404)

      expect(await f.contract.whitelist(f.randomAddresses[1])).to.equal(false)

      // Add a random address to the whitelist
      await f.contract
        .connect(f.signers[0])
        .setWhitelist(f.randomAddresses[1], true)
      expect(await f.contract.whitelist(f.randomAddresses[1])).to.equal(true)

      // Remove the random address from the whitelist
      await f.contract
        .connect(f.signers[0])
        .setWhitelist(f.randomAddresses[1], false)
      expect(await f.contract.whitelist(f.randomAddresses[1])).to.equal(false)
    })

    it("An address cannot be removed from the whitelist while it has an ERC-20 balance >= 1 full token.", async function () {
      const f = await loadFixture(deployExampleERC404)

      const targetAddress = f.randomAddresses[0]

      // Transfer 1 full NFT worth of tokens to that address.
      await f.contract
        .connect(f.signers[0])
        .transfer(targetAddress, f.deployConfig.units)

      expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(1n)

      // Add that address to the whitelist.
      await f.contract.connect(f.signers[0]).setWhitelist(targetAddress, true)

      // Attempt to remove the random address from the whitelist.
      await expect(
        f.contract.connect(f.signers[0]).setWhitelist(targetAddress, false),
      ).to.be.revertedWithCustomError(f.contract, "CannotRemoveFromWhitelist")
    })
  })

  describe.skip("#transferFrom", function () {})

  describe.skip("#erc721BalanceOf", function () {})

  describe.skip("#erc20BalanceOf", function () {})

  describe("#setApprovalForAll", function () {
    context(
      "Granting approval to a valid address besides themselves",
      function () {
        it("Allows a user to set an operator who has approval for all their ERC-721 tokens", async function () {
          const f = await loadFixture(deployExampleERC404)

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
            .withArgs(
              f.signers[0].address,
              f.signers[1].address,
              true,
            )
        });

        it("Allows a user to remove an operator's approval for all", async function () {
          const f = await loadFixture(deployExampleERC404)

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
        const f = await loadFixture(deployExampleERC404)

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
        const f = await loadFixture(deployExampleERC404)

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
        const f = await loadFixture(deployExampleERC404)

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
    context("Permitting ERC-721 tokens", function () {
      it("Should revert", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const spender = f.signers[1]

        // Confirm that the token is owned by the grantor
        expect(await f.contract.ownerOf(1n)).to.equal(msgSender.address)

        const sig = await getPermitSignature(f.contractAddress, msgSender, spender.address, 1n, 0n, 1000000000000000000n)

        await expect(
          f.contract
            .connect(msgSender)
            .permit(msgSender, spender, 1n, 1000000000000000000n, sig.v, sig.r, sig.s),
        ).to.be.revertedWithCustomError(f.contract, "InvalidApproval")
      })
    })

    context("Permitting ERC-20 tokens", function () {
      it("Should revert when 0x0 spender", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]

        // Confirm that from has valid balance
        expect(await f.contract.balanceOf(msgSender.address)).to.be.greaterThan(f.deployConfig.units)

        const sig = await getPermitSignature(f.contractAddress, msgSender, ethers.ZeroAddress, f.deployConfig.units, 0n, 1000000000000000000n)

        await expect(
          f.contract
            .connect(msgSender)
            .permit(msgSender, ethers.ZeroAddress, f.deployConfig.units, 1000000000000000000n, sig.v, sig.r, sig.s),
        ).to.be.revertedWithCustomError(f.contract, "InvalidSpender")
      })

      it("Should revert when deadline expired", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const spender = f.signers[1]

        // Confirm that from has valid balance
        expect(await f.contract.balanceOf(msgSender.address)).to.be.greaterThan(f.deployConfig.units)

        const sig = await getPermitSignature(f.contractAddress, msgSender, spender.address, 1n, 0n, 0n)

        await expect(
          f.contract
            .connect(msgSender)
            .permit(msgSender, spender, f.deployConfig.units, 0n, sig.v, sig.r, sig.s),
        ).to.be.revertedWithCustomError(f.contract, "PermitDeadlineExpired")
      })

      it("Should set approval under valid conditions", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const spender = f.signers[1]

        // Confirm that from has valid balance
        expect(await f.contract.balanceOf(msgSender.address)).to.be.greaterThan(f.deployConfig.units)

        const sig = await getPermitSignature(f.contractAddress, msgSender, spender.address, f.deployConfig.units, 0n, 1000000000000000000n)

        const permitTx = await f.contract
          .connect(spender)
          .permit(msgSender, spender, f.deployConfig.units, 1000000000000000000n, sig.v, sig.r, sig.s)

        expect(await f.contract.allowance(msgSender.address, spender.address)).to.eq(f.deployConfig.units);

        await expect(permitTx)
          .to.emit(f.contract, "ERC20Approval")
          .withArgs(
            f.signers[0].address,
            f.signers[1].address,
            f.deployConfig.units,
          )
      })
    })
  })

  describe("#setApproval", function () {
    context("Granting approval for ERC-721 tokens", function () {
      it("Allows a token owner to grant specific ERC-721 token approval to an operator", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const intendedOperator = f.signers[1]

        // Confirm that the token is owned by the grantor
        expect(await f.contract.ownerOf(1n)).to.equal(msgSender.address)

        // Add an operator for msgSender
        const erc721ApprovalTx = await f.contract
          .connect(msgSender)
          .approve(intendedOperator.address, 1n)

        const isApproved = await f.contract.getApproved(1n)

        expect(isApproved).to.equal(intendedOperator.address)

        // Confirm that a corresponding ERC-20 approval for the ERC-721 token was not set.
        expect(
          await f.contract.allowance(
            msgSender.address,
            intendedOperator.address,
          ),
        ).to.equal(0n)

        await expect(erc721ApprovalTx)
          .to.emit(f.contract, "ERC721Approval")
          .withArgs(
            f.signers[0].address,
            f.signers[1].address,
            1n,
          )
      })

      it("Allows a token owner to revoke specific ERC-721 token approval from an operator", async function () {
        const f = await loadFixture(
          deployMinimalERC404WithERC20sAndERC721sMinted,
        )

        const msgSender = f.signers[0]
        const intendedOperator = f.signers[1]

        // Confirm that the token is owned by the grantor
        expect(await f.contract.ownerOf(1n)).to.equal(msgSender.address)

        // Add an operator for msgSender
        await f.contract
          .connect(msgSender)
          .approve(intendedOperator.address, 1n)

        let isApproved = await f.contract.getApproved(1n)

        expect(isApproved).to.equal(intendedOperator.address)

        // Remove the operator
        await f.contract.connect(msgSender).approve(ethers.ZeroAddress, 1n)

        isApproved = await f.contract.getApproved(1n)

        expect(isApproved).to.equal(ethers.ZeroAddress)
      })

      context(
        "Having already granted approval for all to a valid address",
        function () {
          it("Allows an approved operator to grant specific approval for any ERC-721 token owned by the grantor", async function () {
            const f = await loadFixture(
              deployMinimalERC404ForHavingAlreadyGrantedApprovalForAllTests,
            )

            // Confirm that the token is owned by the grantor
            expect(await f.contract.ownerOf(1n)).to.equal(f.msgSender.address)

            // Approve the operator to transfer the token
            await f.contract
              .connect(f.intendedOperator)
              .approve(f.secondOperator.address, 1n)

            expect(await f.contract.getApproved(1n)).to.equal(
              f.secondOperator.address,
            )
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

        // Get the current minted number of ERC-721 tokens.
        const minted = await f.contract.erc721TotalSupply()

        const allowanceToSet = minted + 1n

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
          .to.emit(f.contract, "ERC20Approval")
          .withArgs(
            f.signers[0].address,
            f.signers[1].address,
            allowanceToSet,
          )
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
    it("Minting out the full supply, making ERC-20 and ERC-721 transfers, banking and retrieving tokens, and setting and removing whitelist addresses", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Initial minting. Will mint ERC-20 and ERC-721 tokens.
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          true,
        )

      // Expect the minted count to be equal to the max total supply
      expect(await f.contract.erc721TotalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )

      // Expect the total supply to be equal to the max total supply
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, 1n, true)

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
        expect(await f.contract.ownerOf(i)).to.equal(f.signers[1].address)
      }

      // Transfer 5 full tokens as ERC-20 from the mint recipient to another address (not whitelisted) (tokens 95-100)
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
        expect(await f.contract.ownerOf(i)).to.equal(f.signers[1].address)
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
        expect(await f.contract.ownerOf(i)).to.equal(f.signers[2].address)
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
        expect(await f.contract.ownerOf(i)).to.equal(f.signers[2].address)
      }

      // Expect the contract to have 0 ERC-721 token
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)
      // Expect the contract to hold token id 96
      await expect(f.contract.ownerOf(96n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )

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
        expect(await f.contract.ownerOf(i)).to.equal(f.signers[2].address)
      }

      // Expect the contract still hold 0 tokens
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)

      // Expect token 96 and 97 to be owned by the zero address
      await expect(f.contract.ownerOf(96n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )

      await expect(f.contract.ownerOf(97n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )

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
      expect(await f.contract.ownerOf(100n)).to.equal(f.signers[2].address)

      // Expect tokens 96 and 97 to still be owned by the zero address
      await expect(f.contract.ownerOf(96n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )

      await expect(f.contract.ownerOf(97n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )

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
      expect(await f.contract.ownerOf(96n)).to.equal(f.signers[5].address)

      // Expect the sender to have 1 * units ERC-20 tokens and 1 ERC-721 token
      expect(await f.contract.erc20BalanceOf(f.signers[2].address)).to.equal(
        1n * f.deployConfig.units,
      )
      expect(await f.contract.erc721BalanceOf(f.signers[2].address)).to.equal(
        1n,
      )

      // Expect the sender to hold token id 100
      expect(await f.contract.ownerOf(100n)).to.equal(f.signers[2].address)

      // Expect the zero address to still hold token id 97
      await expect(f.contract.ownerOf(97n)).to.be.revertedWithCustomError(
        f.contract,
        "NotFound",
      )
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
          expect(await f.contract.erc721TokensBankedInQueue()).to.equal(0n)

          expect(await f.contract.erc721TotalSupply()).to.equal(0n)

          // Mint a new full ERC-20 token + corresponding ERC-721 token
          await f.contract.mintERC20(
            f.signers[0].address,
            f.deployConfig.units,
            true,
          )

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
          expect(await f.contract.erc721TokensBankedInQueue()).to.equal(0n)

          expect(await f.contract.erc721TotalSupply()).to.equal(0n)

          // Mint a new full ERC-20 token + corresponding ERC-721 token
          await f.contract.mintERC20(
            f.signers[0].address,
            f.deployConfig.units,
            true,
          )

          expect(await f.contract.erc721TotalSupply()).to.equal(1n)

          // Transfer the factional token to the contract
          await f.contract.connect(f.signers[0]).transferFrom(f.signers[0].address, f.contractAddress, 1n)

          // Expect the contract to have 0 ERC-721 token
          expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(
            1n,
          )

          // Expect the contract to have 0 ERC-721 token in the queue
          expect(await f.contract.erc721TokensBankedInQueue()).to.equal(0n)

          // Expect the contract to own token 1
          expect(await f.contract.ownerOf(1n)).to.equal(f.contractAddress)

          // Mint a new full ERC-20 token + corresponding ERC-721 token
          await f.contract.mintERC20(
            f.signers[0].address,
            f.deployConfig.units,
            true,
          )

          expect(await f.contract.erc721TotalSupply()).to.equal(2n)

          // Expect the contract to still own token 1
          expect(await f.contract.ownerOf(1n)).to.equal(f.contractAddress)

          // Expect the mint recipient to have have a balance of 1 ERC-721 token
          expect(
            await f.contract.erc721BalanceOf(f.signers[0].address),
          ).to.equal(1n)

          // Expect the contract to have an ERC-20 balance of 1 full token
          expect(
            await f.contract.erc20BalanceOf(f.signers[0].address),
          ).to.equal(f.deployConfig.units)

          // Expect the mint recipient to be the owner of token 2
          expect(await f.contract.ownerOf(2n)).to.equal(f.signers[0].address)
        })
      })
    })
  })
})
