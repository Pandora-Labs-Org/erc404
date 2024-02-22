import { ethers } from "hardhat"
import fs from "fs"
import { StandardMerkleTree } from "@openzeppelin/merkle-tree"

/**
 * Will cache the events in a file and load them from there if the file exists. Otherwise, it will query the contract for the events and store them in a file.
 * @param contract
 * @param startBlock
 * @param endBlock
 * @returns
 */
async function loadOrGenerateEventsFile(contract, startBlock, endBlock) {
  const eventsFilename = `events-${await contract.getAddress()}-${startBlock}-${endBlock}.json`

  if (fs.existsSync(`tmp/${eventsFilename}`)) {
    console.log(`Loading events from file: ${eventsFilename}`)
    const events = JSON.parse(
      fs.readFileSync(`tmp/${eventsFilename}`).toString(),
    )
    return events
  } else {
    const filter = contract.filters.ERC20Transfer(null, null, null)
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

    return events
  }
}

/**
 * Performs the balance calculations based on the events.
 * @param events
 * @returns
 */
function processEvents(events) {
  const balances: Record<string, bigint> = {}

  for (const event of events) {
    // Parse the event using the Pandora interface abi.
    const iface = new ethers.Interface([
      "event ERC20Transfer(address indexed from, address indexed to, uint256 value)",
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
async function performFullCheck(contract, pandoraDeployer, balances, endBlock) {
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
 * Main function.
 */
async function main() {
  const startBlock = 19139822
  const endBlock = 19279784
  const pandoraDeployer = "0xbC17fBf63177bC1110f460c4B1386f230d0Fcef3"
  const runCheck = false
  const pandoraFactory = await ethers.getContractFactory("Pandora")

  // Connect to the deployed mainnet contract.
  const pandoraMainnetAddress = "0x9E9FbDE7C7a83c43913BddC8779158F1368F0413"
  const pandoraContract = await pandoraFactory.attach(pandoraMainnetAddress)

  //  First load the events.
  const events = await loadOrGenerateEventsFile(
    pandoraContract,
    startBlock,
    endBlock,
  )

  // Then process the events.
  console.log(`Loaded ${events.length} events`)
  const balances = processEvents(events)

  if (runCheck) {
    console.log("Performing full check")
    await performFullCheck(pandoraContract, pandoraDeployer, balances, endBlock)
  } else {
    console.log("Skipping full check")
  }

  const balancesFilename = `unfiltered-balances-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`

  // Store the balances in a file.
  fs.writeFileSync(`tmp/${balancesFilename}`, JSON.stringify(balances, null, 2))
  console.log("Saved unfiltered balances to file", balancesFilename)

  // Filtering step -- this is business logic specific area where you can filter out addresses that you don't want to include in the snapshot.
  // Remove the deployer (he has a negative balance due to the initial minting).
  const filteredBalances = await filterBalances(balances, [
    pandoraDeployer,
    await pandoraContract.getAddress(),
  ])

  // Store the filtered balances in a file.
  const filteredBalancesFilename = `filtered-balances-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`
  fs.writeFileSync(
    `tmp/${filteredBalancesFilename}`,
    JSON.stringify(filteredBalances, null, 2),
  )
  console.log("Saved filtered balances to file", filteredBalancesFilename)

  // Generate the merkle tree.
  const tree = await generateMerkleTree(filteredBalances)

  // Store the merkle tree in a file.
  const treeFilename = `tree-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`
  fs.writeFileSync(`tmp/${treeFilename}`, JSON.stringify(tree.dump()))
  console.log("Saved merkle tree to file", treeFilename)

  // Print the merkle tree root.
  console.log("Merkle root:", tree.root)

  console.log("Done")
}

async function filterBalances(balances, badAddresses) {
  const filteredBalances = { ...balances }

  // Remove Uniswap V2 PANDORA+WETH pool.
  const uniswapV2Pool = "0xdc900845732a53eE8Df737EfA282A6Bc56976e62"
  // Remove all active Uniswap V3 PANDORA+WETH pools.
  const uniswapV3Pools = [
    "0x1dF4C6e36d61416813B42fE32724eF11e363EDDc", // 1% fee tier
  ]

  // Add some extra bad addresses.
  const finalBadAddresses = [
    ...badAddresses,
    uniswapV2Pool,
    ...uniswapV3Pools,
    ethers.ZeroAddress,
    "0x000000000000000000000000000000000000dEaD",
  ]

  // Remove the bad addresses.
  finalBadAddresses.forEach((address) => {
    delete filteredBalances[address]
  })

  // Delete entires with a balance < 1 PANDORA.
  for (const [address, balance] of Object.entries(filteredBalances)) {
    if (BigInt(balance) < ethers.parseEther("1")) {
      delete filteredBalances[address]
    }
  }

  return filteredBalances
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
