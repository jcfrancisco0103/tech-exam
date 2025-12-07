import { ethers } from 'hardhat'

async function main() {
  const MyToken = await ethers.getContractFactory('MyToken')
  const base = 'http://localhost:3001/metadata/'
  const contract = await MyToken.deploy('TechExamToken', 'TET', base)
  await contract.waitForDeployment()
  console.log('MyToken deployed to:', await contract.getAddress())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
