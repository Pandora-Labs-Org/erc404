import { ethers } from "hardhat"
import fs from "fs"
import { StandardMerkleTree } from "@openzeppelin/merkle-tree"
import * as ss from "simple-statistics"
import csv from "csv-stringify/sync"

/**
 * Will cache the events in a file and load them from there if the file exists. Otherwise, it will query the contract for the events and store them in a file.
 * @param contract
 * @param startBlock
 * @param endBlock
 * @returns
 */
async function loadOrGenerateEventsFile(
  contract,
  startBlock: number,
  endBlock: number,
  isPandora: boolean,
) {
  const eventsFilename = `events-${await contract.getAddress()}-${startBlock}-${endBlock}.json`

  if (fs.existsSync(`tmp/${eventsFilename}`)) {
    console.log(`Loading events from file: ${eventsFilename}`)
    const events = JSON.parse(
      fs.readFileSync(`tmp/${eventsFilename}`).toString(),
    )

    console.log(`Found ${events.length} events`)
    return events
  } else {
    const filter = isPandora
      ? contract.filters.ERC20Transfer(null, null, null)
      : contract.filters.Transfer(null, null, null)
    const events = []
    for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += 1000) {
      // Ensure toBlock is either the end of the batch or the endBlock, whichever is smaller.
      // Subtract 1 to make the range inclusive and non-overlapping.
      const toBlock = Math.min(fromBlock + 999, endBlock)
      const newEvents = await contract.queryFilter(filter, fromBlock, toBlock)

      console.log(
        `Loading events from block ${fromBlock} to ${toBlock} (found ${newEvents.length} events for a total of ${events.length + newEvents.length} events)`,
      )

      events.push(...newEvents)
    }

    // Store the events in a JSON file.
    fs.writeFileSync(`tmp/${eventsFilename}`, JSON.stringify(events, null, 2))

    console.log(`Found ${events.length} events`)
    return events
  }
}

/**
 * Performs the balance calculations based on the events.
 * @param events
 * @returns
 */
function processEvents(events, isPandora: boolean) {
  const balances: Record<string, bigint> = {}

  for (const event of events) {
    // Parse the event using the Pandora interface abi.
    const iface = isPandora
      ? new ethers.Interface([
          "event ERC20Transfer(address indexed from, address indexed to, uint256 value)",
        ])
      : new ethers.Interface([
          "event Transfer(address indexed from, address indexed to, uint256 value)",
        ])

    const parsedEvent = iface.parseLog(event)

    const from = parsedEvent.args[0]
    const to = parsedEvent.args[1]
    const value = BigInt(parsedEvent.args[2])

    if (from !== ethers.ZeroAddress) {
      if (!balances[from]) {
        balances[from] = 0n
      }
      balances[from] = balances[from] - value
    }

    if (to !== ethers.ZeroAddress) {
      if (!balances[to]) {
        balances[to] = 0n
      }
      balances[to] = balances[to] + value
    }
  }

  return balances
}

/**
 * An optional full check to ensure the balances are correct by querying the contract for the balances at the cutoff block height.
 */
async function performFullOnchainBalanceCheck(
  contract,
  pandoraDeployer,
  balances,
  endBlock,
) {
  const numberOfAddresses = Object.keys(balances).length
  let i = 0

  // Go through and spot check the balances against the last block we observed in the events.
  for (const [address, balance] of Object.entries(balances)) {
    console.log("Checking balance for", address, `(${i}/${numberOfAddresses})`)
    const balanceFromContract = await contract.balanceOf(address, {
      blockTag: endBlock,
    })

    if (
      balance !== BigInt(balanceFromContract) &&
      address !== ethers.ZeroAddress &&
      address !== pandoraDeployer
    ) {
      throw new Error(
        `Balance mismatch for ${address}: ${balance} !== ${balanceFromContract}`,
      )
    }

    i++
  }
}

/**
 * Generates a merkle tree from the balances.
 * @param balances
 * @returns
 */
async function generateMerkleTree(balances) {
  const flattenedBalances = Object.entries(balances).map(
    ([address, balance]) => {
      return [address, balance]
    },
  )

  const tree = StandardMerkleTree.of(flattenedBalances, [
    "address", // claimer
    "uint256", // totalValue
  ])

  return tree
}

/**
 * Filters out addresses that should not be included in the snapshot.
 * @param balances
 * @param badAddresses
 * @param cutoff
 * @returns
 */
async function filterBalances(balances, badAddresses, cutoff) {
  const filteredBalances = { ...balances }

  // Remove Uniswap V2 PANDORA+WETH pool.
  const uniswapV2Pool = "0xdc900845732a53eE8Df737EfA282A6Bc56976e62"
  // Remove all active Uniswap V3 PANDORA+WETH pools.
  const uniswapV3Pools = [
    "0x1dF4C6e36d61416813B42fE32724eF11e363EDDc", // 1% fee tier
  ]

  const deadAddress = "0x000000000000000000000000000000000000dEaD"
  const pandoraPodAddress = "0xf109BA50e6697F2579d5B073f347520373C2ADb3"

  // Add some extra bad addresses. Run list through ethers.getAddress to ensure they are checksummed.
  const finalBadAddresses = [
    ...badAddresses,
    uniswapV2Pool,
    ...uniswapV3Pools,
    ethers.ZeroAddress,
    deadAddress,
    pandoraPodAddress,
  ].map((address) => ethers.getAddress(address))

  // Remove the bad addresses.
  finalBadAddresses.forEach((address) => {
    delete filteredBalances[address]
  })

  // Delete entires with a balance < the cutoff in PANDORA.
  for (const [address, balance] of Object.entries(filteredBalances)) {
    if (BigInt(balance) < cutoff) {
      delete filteredBalances[address]
    }
  }

  return filteredBalances
}

function calculateAirdropDistribution(
  balances: Record<string, bigint>,
  availableAirdropAmount: bigint,
  fullTokenMultiplier: bigint = 2n,
): Record<string, bigint> {
  // Use a large factor for precision in division.
  const precisionFactor = BigInt(10 ** 18)

  // Balances >= 1 PANDORA get a 2x multiplier.
  for (const address in balances) {
    const oneEtherInWei = ethers.parseEther("1")
    if (balances[address] >= oneEtherInWei) {
      balances[address] = balances[address] * fullTokenMultiplier
    }
  }

  // Calculate the total balance.
  const totalBalance = Object.values(balances).reduce(
    (acc, balance) => acc + balance,
    0n,
  )

  console.log("Total balance:", ethers.formatEther(totalBalance))

  const airdropDistribution: Record<string, bigint> = {}

  for (const address in balances) {
    // Calculate the share of each balance in basis points to avoid floating-point operations.
    const balancePercentage =
      (balances[address] * precisionFactor) / totalBalance
    // Calculate the airdrop amount for each address.
    airdropDistribution[address] =
      (balancePercentage * availableAirdropAmount) / precisionFactor
  }

  // Debug: Sum of airdrop distribution to compare to available airdrop amount.
  const sum = Object.values(airdropDistribution).reduce(
    (acc, value) => acc + value,
    0n,
  )

  console.log("Total airdrop distribution:", ethers.formatEther(sum))
  console.log(
    "Available airdrop amount:",
    ethers.formatEther(availableAirdropAmount),
  )

  return airdropDistribution
}

async function peapodsSnapshot(contract, startBlock: number, endBlock: number) {
  //  First load the events.
  const events = await loadOrGenerateEventsFile(
    contract,
    startBlock,
    endBlock,
    false,
  )

  // Then process the events.
  console.log(`Loaded ${events.length} events`)
  const balances = processEvents(events, false)

  return balances
}

/**
 * Main function.
 */
async function main() {
  // Configuration.
  const startBlock = 19139822
  const endBlock = 19279784
  const pandoraDeployer = "0xbC17fBf63177bC1110f460c4B1386f230d0Fcef3"
  const runFullOnchainBalanceCheck = false
  const airdropCutoff = ethers.parseEther("0.01")
  const pandoraMultisig = "0x508894ABC5905eBE8c5B6D6EcaA0Fe24Bb63aB0b"
  const lockup = "0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9"
  const pandoraMainnetAddress = "0x9E9FbDE7C7a83c43913BddC8779158F1368F0413"
  const fullTokenHolderMultiplier = 2n
  const availableAirdropAmount = ethers.parseEther("349")
  // Peapods
  const includePeapods = true
  const podStartBlock = 19167200
  const pandoraPodMainnetAddress = "0xf109BA50e6697F2579d5B073f347520373C2ADb3"

  // Connect to the deployed mainnet Pandora contract.
  const pandoraFactory = await ethers.getContractFactory("Pandora")
  const pandoraContract = await pandoraFactory.attach(pandoraMainnetAddress)

  //  First load the events.
  const events = await loadOrGenerateEventsFile(
    pandoraContract,
    startBlock,
    endBlock,
    true,
  )

  // Then process the events.
  const balances = processEvents(events, true)

  if (runFullOnchainBalanceCheck) {
    console.log("Performing full on-chain balance check")
    await performFullOnchainBalanceCheck(
      pandoraContract,
      pandoraDeployer,
      balances,
      endBlock,
    )
  } else {
    console.log("Skipping full on-chain balance check")
  }

  // Check -- Make sure that there are no duplicate addresses.
  const uniqueAddresses = new Set(Object.keys(balances))
  if (uniqueAddresses.size !== Object.keys(balances).length) {
    throw new Error("Duplicate addresses found")
  }

  const balancesFilename = `unfiltered-balances-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`

  // Store the balances in a file.
  fs.writeFileSync(`tmp/${balancesFilename}`, JSON.stringify(balances, null, 2))
  console.log("Saved unfiltered balances to file", balancesFilename)

  if (includePeapods) {
    // Connect to the deployed mainnet Pandora Pod contract using a MockERC20 interface.
    const pandoraPodFactory = await ethers.getContractFactory("MockERC20")
    const pandoraPodContract = await pandoraPodFactory.attach(
      pandoraPodMainnetAddress,
    )

    // Take Pandora peapods snapshot
    const pandoraPeapodsBalances = await peapodsSnapshot(
      pandoraPodContract,
      podStartBlock,
      endBlock,
    )

    // Check that the sum of all balances is equal to the PANDORA balance in the contract
    const sum = Object.values(pandoraPeapodsBalances).reduce(
      (acc, value) => acc + value,
      0n,
    )
    const contractBalance = await pandoraContract.balanceOf(
      pandoraPodMainnetAddress,
      {
        blockTag: endBlock,
      },
    )

    console.log("Sum of all pPDRA balances:", ethers.formatEther(sum))
    console.log(
      "PANDORA balance of pPDRA contract:",
      ethers.formatEther(contractBalance),
    )

    // Merge the two balance sets.
    for (const [address, balance] of Object.entries(pandoraPeapodsBalances)) {
      if (!balances[address]) {
        balances[address] = 0n
      }
      balances[address] += balance
    }
  }

  // Filtering step -- this is business logic specific area where you can filter out addresses that you don't want to include in the snapshot.
  // Remove the deployer (he has a negative balance due to the initial minting).
  const filteredBalances = await filterBalances(
    balances,
    [
      pandoraDeployer,
      await pandoraContract.getAddress(),
      pandoraMultisig,
      lockup,
    ],
    airdropCutoff,
  )

  // Perform some sanity checks.
  // Make sure that no address has a negative balance.
  for (const [address, balance] of Object.entries(filteredBalances)) {
    if (balance < 0n) {
      throw new Error(`Negative balance found for ${address}`)
    }
  }

  // Store the filtered balances in a file.
  const filteredBalancesFilename = `filtered-balances-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`
  fs.writeFileSync(
    `tmp/${filteredBalancesFilename}`,
    JSON.stringify(filteredBalances, null, 2),
  )
  console.log("Saved filtered balances to file", filteredBalancesFilename)

  // Generate descriptive statistics.
  // Map balaces to a flat array of just the balance values for stats.
  const balanceValues = Object.values(filteredBalances).map((balance) =>
    Number(ethers.formatEther(balance)),
  )

  // save to a csv file
  const csvFilename = `balances-${await pandoraContract.getAddress()}-${startBlock}-${
    endBlock - 1
  }.csv`

  const csvData = balanceValues.join("\n")
  fs.writeFileSync(`tmp/${csvFilename}`, csvData)

  console.log("Saved balance values to file", csvFilename)

  const airdropQualifyingAddresses = Object.keys(filteredBalances).length

  console.log("Airdrop qualifying addresses:", airdropQualifyingAddresses)

  const fullTokenHolders = Object.values(filteredBalances).filter(
    (balance) => balance >= ethers.parseEther("1"),
  ).length

  console.log("Full token holders:", fullTokenHolders)

  // Calculate the airdrop distribution.
  const airdropDistribution = calculateAirdropDistribution(
    filteredBalances,
    availableAirdropAmount,
    fullTokenHolderMultiplier, // multiplier for balances >= 1 PANDORA
  )

  // Store the airdrop distribution in a file.
  const airdropDistributionFilename = `airdrop-distribution-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`

  // Save as a CSV using csv-stringify
  const records = Object.entries(airdropDistribution).map(
    ([address, amount]) => [address, ethers.formatEther(amount)],
  )
  const csvString = await csv.stringify(records)
  fs.writeFileSync(`tmp/${airdropDistributionFilename}.csv`, csvString)
  console.log("Saved airdrop distribution to file", airdropDistributionFilename)

  // Generate the merkle tree.
  const tree = await generateMerkleTree(airdropDistribution)

  // Store the merkle tree in a file.
  const treeFilename = `tree-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`
  fs.writeFileSync(`tmp/${treeFilename}`, JSON.stringify(tree.dump()))
  console.log("Saved merkle tree to file", treeFilename)

  // Print the merkle tree root.
  console.log("Merkle root:", tree.root)

  console.log("Done")
}

/**
 * Run the main function and handle errors.
 */
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
