// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const config = require('../src/config.json')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

async function main() {

    console.log(`Fetching accounts & network...\n`)

    const accounts = await ethers.getSigners()
    const funder = accounts[0]
    const investor1 = accounts[1]
    const investor2 = accounts[2]
    const investor3 = accounts[3]
    const recipient = accounts[4]

    let transaction

    // Fetch network
    const { chainId } = await ethers.provider.getNetwork()

    console.log(`Fetching token and transfering to accounts...\n`)

    const token = await ethers.getContractAt('Token', config[chainId].token.address)
    console.log(`Token fetched: ${token.address}\n`)

    // Send tokens to investors each one gets 20%
    transaction = await token.transfer(investor1.address, tokens(200000))
    await transaction.wait()
    console.log(`Transferred tokens to ${investor1.address}\n`)

    transaction = await token.transfer(investor2.address, tokens(200000))
    await transaction.wait()
    console.log(`Transferred tokens to ${investor2.address}\n`)

    transaction = await token.transfer(investor3.address, tokens(200000))
    await transaction.wait()
    console.log(`Transferred tokens to ${investor3.address}\n`)

    console.log(`Fetching DAO ...\n`)
    
    // fetch deployed contract
    const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)
    console.log(`DAO fetched: ${dao.address}\n`)

    // Send 100 ether to DAO treasury for Governance
    transaction = await funder.sendTransaction({to: dao.address, value: ether(1000)})
    await transaction.wait()
    console.log(`Sent funds to DAO treasury\n`)

    for (var i = 0; i < 3; i++) {
        // create proposal
        transaction = await dao.connect(investor1).createProposal(`Proposal ${i + 1}`, ether(100), recipient.address)
        await transaction.wait()
        console.log(`Created proposal ${i + 1}\n`)

        // vote 1 - for
        transaction = await dao.connect(investor1).voteFor(i + 1)
        await transaction.wait()
        console.log(`Investor 1 voted for proposal ${i + 1}\n`)

        // vote 2 - for
        transaction = await dao.connect(investor2).voteFor(i + 1)
        await transaction.wait()
        console.log(`Investor 2 voted for proposal ${i + 1}\n`)

        // vote 3 - for
        transaction = await dao.connect(investor3).voteFor(i + 1)
        await transaction.wait()
        console.log(`Investor 3 voted for proposal ${i + 1}\n`)

        // finalize
        transaction = await dao.connect(investor1).finalizeProposal(i + 1)
        await transaction.wait()
        console.log(`Finalized proposal ${i + 1}\n`)
    }

    // Create one more proposal that has votes both for and against
    transaction = await dao.connect(investor1).createProposal(`Proposal 4`, ether(100), recipient.address)
    await transaction.wait()
    console.log(`Created proposal 4\n`)

    // vote 1 - for
    transaction = await dao.connect(investor1).voteFor(4)
    await transaction.wait()
    console.log(`Investor 1 voted for proposal 4\n`)

    // vote 2 - against
    transaction = await dao.connect(investor2).voteAgainst(4)
    await transaction.wait()
    console.log(`Investor 2 voted against proposal 4\n`)

    // This proposal won't be finalized, showing a proposal in progress

    console.log(`Finished.\n`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
