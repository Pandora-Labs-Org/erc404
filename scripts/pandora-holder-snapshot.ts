import { ethers } from "hardhat"
import fs from "fs"

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

  const balancesFilename = `balances-${await pandoraContract.getAddress()}-${startBlock}-${endBlock}.json`

  // Store the results in a file
  fs.writeFileSync(`tmp/${balancesFilename}`, JSON.stringify(balances, null, 2))
  console.log("Saved balances to file", balancesFilename)
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
