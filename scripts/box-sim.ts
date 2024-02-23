import { ethers } from "hardhat"

async function main() {
  const signers = await ethers.getSigners()
  console.log("Deploying contracts with the account:", signers[0].address)

  // Deploy the Box contract.
  const boxFactory = await ethers.getContractFactory("Box")
  const boxContract = await boxFactory.deploy(signers[0].address)
  await boxContract.waitForDeployment()

  const boxAddress = await boxContract.getAddress()

  console.log("Box contract deployed to:", boxAddress)

  // Deploy a test ERC-404 contract that is offering an airdrop.
  const erc404Factory = await ethers.getContractFactory("ERC404Example")
  const erc404Contract = await erc404Factory.deploy(
    "ERC404Example",
    "ERC404",
    18,
    500,
    signers[0].address,
    signers[0].address,
  )

  await erc404Contract.waitForDeployment()

  const exampleERC404Address = await erc404Contract.getAddress()

  console.log("ERC404 contract deployed to:", exampleERC404Address)

  // Transfer some tokens to the Box contract.
  const balance = await erc404Contract.balanceOf(signers[0].address)
  await erc404Contract.transfer(boxAddress, balance)

  await boxContract.setMerkleRoot(
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "0x49e9d4985d6d55d1ec44fa75470772021d1698af3ce72a78c28f151238a37dff",
  )

  const result = await boxContract.merkleRoots(
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  )

  console.log(result)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
