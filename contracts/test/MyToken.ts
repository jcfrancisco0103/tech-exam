import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('MyToken', () => {
  it('mints and enumerates tokens', async () => {
    const [owner, other] = await ethers.getSigners()
    const MyToken = await ethers.getContractFactory('MyToken')
    const token = await MyToken.deploy('TechExamToken', 'TET')
    await token.waitForDeployment()

    const addr = await token.getAddress()
    expect(addr).to.properAddress

    const id0 = await token.safeMint(owner.address)
    await id0.wait()

    const bal = await token.balanceOf(owner.address)
    expect(bal).to.equal(1n)

    const index0 = await token.tokenOfOwnerByIndex(owner.address, 0)
    expect(index0).to.equal(0n)

    const id1 = await token.safeMint(other.address)
    await id1.wait()

    const balOther = await token.balanceOf(other.address)
    expect(balOther).to.equal(1n)
  })
})
