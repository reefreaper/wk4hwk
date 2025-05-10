const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

describe('DAO', () => {
    let token, dao
    let deployer, 
        funder,
        investor1,
        investor2,
        investor3,
        investor4,
        investor5,
        recipient,
        user

  beforeEach(async () => {
    // Setup accouts
    let accounts = await ethers.getSigners()
    deployer = accounts[0]
    funder = accounts[1]
    investor1 = accounts[2]
    investor2 = accounts[3]
    investor3 = accounts[4]
    investor4 = accounts[5]
    investor5 = accounts[6]
    recipient = accounts[7]
    user = accounts[8]

    // Deploy token
    const Token = await ethers.getContractFactory('Token')
    token = await Token.deploy('Dapp University', 'DAPP', '1000000')

    // Send tokens to investors each one gets 20%
    transaction = await token.connect(deployer).transfer(investor1.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor2.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor3.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor4.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor5.address, tokens(200000))
    await transaction.wait()

    // Deploy DAO
    // Set Quorum to > 50% of token total supply
    // 500k tokens + 1 wei, i.e. 500,000.000000000000001
    const DAO = await ethers.getContractFactory('DAO')
    dao = await DAO.deploy(token.address, '500000000000000000000001')

    // Funder sends 100 ehter to DAO treasury for Governance
    await funder.sendTransaction({to: dao.address, value: ether(100)})
  })

  describe('Deployment', () => {

    it('sends ether to the DAO treasury', async () => {
      expect(await ethers.provider.getBalance(dao.address)).to.equal(ether(100))
    })

    it('returns token address', async () => {
      expect(await dao.token()).to.equal(token.address)
    })

    it('returns quorum', async () => {
      expect(await dao.quorum()).to.equal('500000000000000000000001')
    })

  })

  describe('Creating Proposals', () => {
    let transaction, result

    describe('Success', () => {

      beforeEach(async () => {
        transaction = await dao.connect(investor1).createProposal('Proposal 1', tokens(100), recipient.address)
        result = await transaction.wait()
      })

      it('updates proposal count', async () => {
        expect(await dao.proposalCount()).to.equal(1)
      })

      it('updates proposal mapping', async () => {
        const proposal = await dao.proposals(1)

        expect(proposal.id).to.equal(1)
        //expect(proposal.name).to.equal('Proposal 1')
        expect(proposal.amount).to.equal(ether(100))
        expect(proposal.recipient).to.equal(recipient.address)
        //expect(proposal.votes).to.equal(0)
        //expect(proposal.finalized).to.equal(false)
      })

      it('emits a propose event', async () => {
        await expect(transaction).to.emit(dao, 'Propose').
          withArgs(1, ether(100), recipient.address, investor1.address)
      })

    })

    describe('Failure', () => {
      it('rejects invalid amounts', async () => {
        await expect(dao.connect(investor1).createProposal(
          'Proposal 1',
          ether(1000),
          recipient.address)).to.be.reverted
      })

      it('rejects non-investor', async () => {
        await expect(dao.connect(user).createProposal(
          'Proposal 1',
          ether(100),
          recipient.address)).to.be.reverted
      })

    })

    describe('Voting', () => {
      let transaction, result

      describe('Success', () => {
        beforeEach(async () => {
          // Vote FOR proposal
          transaction = await dao.connect(investor1).voteFor(1)
          result = await transaction.wait()
        })

        it('updates vote count', async () => {
          const proposal = await dao.proposals(1)
          expect(proposal.votesFor).to.equal(tokens(200000))
          expect(proposal.votesAgainst).to.equal(0)
        })

        it('emits a vote event', async () => {
          await expect(transaction).to.emit(dao, 'Vote')
            .withArgs(1, investor1.address, true) // true for voting "for"
        })
      })

      describe('Voting Against', () => {
        beforeEach(async () => {
          // Vote AGAINST proposal
          transaction = await dao.connect(investor1).voteAgainst(1)
          result = await transaction.wait()
        })

        it('updates vote count', async () => {
          const proposal = await dao.proposals(1)
          expect(proposal.votesFor).to.equal(0)
          expect(proposal.votesAgainst).to.equal(tokens(200000))
        })

        it('emits a vote event', async () => {
          await expect(transaction).to.emit(dao, 'Vote')
            .withArgs(1, investor1.address, false) // false for voting "against"
        })
      })

      describe('Failure', () => {
        it('rejects non-investor', async () => {
          await expect(dao.connect(user).voteFor(1)).to.be.reverted
          await expect(dao.connect(user).voteAgainst(1)).to.be.reverted
        })

        it('rejects double voting', async () => {
          transaction = await dao.connect(investor1).voteFor(1)
          await transaction.wait()

          await expect(dao.connect(investor1).voteFor(1)).to.be.reverted
          await expect(dao.connect(investor1).voteAgainst(1)).to.be.reverted
        })
      })
    })

    describe('Governance', () => {
      let transaction, result 

      describe('Success', () => {
        beforeEach(async () => {
          // Create proposal
          transaction = await dao.connect(investor1).createProposal('Proposal 1', ether(100), recipient.address)
          result = await transaction.wait()
          
          // Vote FOR proposal to reach quorum
          transaction = await dao.connect(investor1).voteFor(1)
          result = await transaction.wait()

          transaction = await dao.connect(investor2).voteFor(1)
          result = await transaction.wait()

          transaction = await dao.connect(investor3).voteFor(1)
          result = await transaction.wait()

          // Add more votes to reach quorum
          transaction = await dao.connect(investor4).voteFor(1)
          result = await transaction.wait()

          transaction = await dao.connect(investor5).voteFor(1)
          result = await transaction.wait()

          // Finalize the proposal
          transaction = await dao.connect(investor1).finalizeProposal(1)
          result = await transaction.wait()
        })

        it('transfers funds to recipient', async () => {
          expect(await ethers.provider.getBalance(dao.address)).to.equal(ether(0))
          expect(await ethers.provider.getBalance(recipient.address)).to.equal(ether(10100))
        })

        it('updates proposal to finalized', async () => {
          const proposal = await dao.proposals(1)
          expect(proposal.finalized).to.equal(true)
        })

        it('emits a Finalize event', async () => {
          await expect(transaction).to.emit(dao, 'Finalize')
            .withArgs(1)
        })
      })

      describe('Failure', () => {
        beforeEach(async () => {
          // Create proposal
          transaction = await dao.connect(investor1).createProposal('Proposal 2', ether(100), recipient.address)
          result = await transaction.wait()
          
          // Vote FOR proposal but not enough to reach quorum
          transaction = await dao.connect(investor1).voteFor(2)
          result = await transaction.wait()
        })

        it('rejects finalize if not enough votes', async () => {
          await expect(dao.connect(investor1).finalizeProposal(2)).to.be.reverted
        })

        it('rejects finalize if more votes against than for', async () => {
          // Create another proposal
          transaction = await dao.connect(investor1).createProposal('Proposal 3', ether(100), recipient.address)
          result = await transaction.wait()
          
          // Vote AGAINST with more votes than FOR
          transaction = await dao.connect(investor1).voteFor(3)
          result = await transaction.wait()

          transaction = await dao.connect(investor2).voteAgainst(3)
          result = await transaction.wait()

          transaction = await dao.connect(investor3).voteAgainst(3)
          result = await transaction.wait()

          transaction = await dao.connect(investor4).voteAgainst(3)
          result = await transaction.wait()

          transaction = await dao.connect(investor5).voteAgainst(3)
          result = await transaction.wait()

          // Try to finalize
          await expect(dao.connect(investor1).finalizeProposal(3)).to.be.reverted
        })

        it('rejects non-investor finalization', async () => {
          await expect(dao.connect(user).finalizeProposal(2)).to.be.reverted
        })

        it('rejects finalize if already finalized', async () => {
          // Create another proposal and get it finalized
          transaction = await dao.connect(investor1).createProposal('Proposal 4', ether(50), recipient.address)
          result = await transaction.wait()
          
          // Vote FOR proposal to reach quorum
          transaction = await dao.connect(investor1).voteFor(4)
          result = await transaction.wait()

          transaction = await dao.connect(investor2).voteFor(4)
          result = await transaction.wait()

          transaction = await dao.connect(investor3).voteFor(4)
          result = await transaction.wait()

          transaction = await dao.connect(investor4).voteFor(4)
          result = await transaction.wait()

          transaction = await dao.connect(investor5).voteFor(4)
          result = await transaction.wait()

          // Finalize
          transaction = await dao.connect(investor1).finalizeProposal(4)
          result = await transaction.wait()

          // Try to finalize again
          await expect(dao.connect(investor1).finalizeProposal(4)).to.be.reverted
        })
      })
    })
  })
})
