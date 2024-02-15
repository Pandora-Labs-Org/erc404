import { ethers } from "hardhat"
import currency from "currency.js"

const gasPrice = ethers.parseUnits("60", "gwei")
const etherPrice = currency(2600)

async function main() {
  const signers = await ethers.getSigners()
  console.log("Deploying contracts with the account:", signers[0].address)

  const pandoraFactory = await ethers.getContractFactory("Pandora")
  const pandoraContract = await pandoraFactory.deploy(signers[0].address)
  await pandoraContract.waitForDeployment()

  message("pandoraContract")
  await runTests(pandoraContract)

  const erc404V2Factory = await ethers.getContractFactory("ERC404Example")
  const erc404V2Contract = await erc404V2Factory.deploy(
    "ERC404Example",
    "ERC404",
    18,
    500,
    signers[0].address,
    signers[0].address,
  )
  await erc404V2Contract.waitForDeployment()

  message("erc404V2Contract")
  await runTests(erc404V2Contract)

  const erc404U16V2Factory = await ethers.getContractFactory("ERC404ExampleU16")
  const erc404U16V2Contract = await erc404U16V2Factory.deploy(
    "ERC404ExampleU16",
    "ERC404U16",
    18,
    500,
    signers[0].address,
    signers[0].address,
  )
  await erc404U16V2Contract.waitForDeployment()

  message("erc404U16V2Contract")
  await runTests(erc404U16V2Contract)
}

async function runTests(contract: ethers.Contract) {
  const signers = await ethers.getSigners()

  console.log("###########################################")
  console.log(
    `## Using gas price of ${ethers.formatUnits(gasPrice, "gwei")} gwei`,
  )
  console.log(`## Using ether price of ${etherPrice.format()} USD per ETH`)
  console.log("###########################################")

  message(
    "The initial owner is exempt so these are being minted for the first time during these transfers:",
  )
  await transfer(contract, signers[0], signers[1], 5n * 10n ** 18n / 10n)

  await transfer(contract, signers[0], signers[1], 1n * 10n ** 18n)

  await transfer(contract, signers[0], signers[1], 10n * 10n ** 18n)

  await transfer(contract, signers[0], signers[1], 100n * 10n ** 18n)

  message(
    "Subsequent transfers from a non-exempt address to another non-exempt address:",
  )

  await transfer(contract, signers[1], signers[2], 5n * 10n ** 18n / 10n)

  await transfer(contract, signers[1], signers[2], 1n * 10n ** 18n)

  await transfer(contract, signers[1], signers[2], 10n * 10n ** 18n)

  await transfer(contract, signers[1], signers[2], 100n * 10n ** 18n)

  message(
    "Transferring back to the original owner who is exempt will burn the NFTs:",
  )

  await transfer(contract, signers[2], signers[0], 5n * 10n ** 18n / 10n)

  await transfer(contract, signers[2], signers[0], 1n * 10n ** 18n)

  await transfer(contract, signers[2], signers[0], 10n * 10n ** 18n)

  await transfer(contract, signers[2], signers[0], 100n * 10n ** 18n)
}

async function transfer(
  contract: ethers.Contract,
  from: ethers.Signer,
  to: ethers.Signer,
  value: bigint,
) {
  lineBreak()

  console.log(
    `Transferring ${ethers.formatEther(value)} tokens as ERC-20 from ${from.address} to ${to.address}`,
  )

  console.log(
    "Balance of from:",
    ethers.formatEther(await contract.balanceOf(from.address)),
    "tokens",
  )

  // Transfer 100 tokens to a new address that is not whitelisted
  const tx1 = await contract.connect(from).transfer(to.address, value)
  const receipt = await tx1.wait()

  // Print gas used
  const gasUsed = BigInt(receipt.gasUsed)
  console.log("Gas used:", gasUsed.toLocaleString(), "gas")

  const wholeTokens = value / 10n ** 18n

  // Print gas used in ETH
  const gasUsedEth = gasUsed * gasPrice
  console.log(
    "Gas cost:",
    ethers.formatEther(gasUsedEth),
    "ETH",
    `(${weiToDollars(gasUsedEth).format()} USD)`,
  )

  if (wholeTokens > 0) {
    const gasUsedPerToken = gasUsed / wholeTokens
    console.log("Effective gas used per token:", gasUsedPerToken.toLocaleString())

    const effectiveGasCostPerToken = ethers.parseUnits(
      (gasUsedEth / wholeTokens).toString(),
      "wei",
    )
    console.log(
      "Effective gas cost per token:",
      ethers.formatEther(effectiveGasCostPerToken),
      "ETH",
      `(${etherPrice.multiply(Number(effectiveGasCostPerToken) / 10 ** 18).format()} USD)`,
    )
  }
}

function weiToDollars(wei: bigint) {
  return etherPrice.multiply(Number(wei) / 10 ** 18)
}

function lineBreak() {
  console.log("====================================")
}

function message(msg: string) {
  console.log("\n##", msg, "##\n")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
