//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

contract DAO {
    address owner;
    Token public token;
    uint256 public quorum;

    struct Proposal {
        uint256 id;
        string name;
        uint256 amount;
        address payable recipient;
        uint256 votesFor;
        uint256 votesAgainst;
        bool finalized;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    // Track who has voted and how they voted
    mapping(address => mapping(uint256 => bool)) hasVoted;
    mapping(address => mapping(uint256 => bool)) voteDirection; // true = for, false = against

    event Propose(
        uint id,
        uint256 amount,
        address recipient,
        address creator
    ); 

    event Vote(
        uint256 id,
        address investor,
        bool direction // true = for, false = against
    );

    event Finalize(
        uint256 id
    );

    constructor(Token _token, uint256 _quorum) {
        owner = msg.sender;
        token = _token;
        quorum = _quorum;
    }

    // Allow contract to receive ETH
    receive() external payable {}

    modifier onlyInvestor() {
        require(
            token.balanceOf(msg.sender) > 0,
            "Must be token holder"
        );
        _;
    }

    function createProposal(
        string memory _name,
        uint256 _amount,
        address payable _recipient
    ) external onlyInvestor {
        require(address(this).balance >= _amount);

        // Increment proposal count
        proposalCount++;

        // Create proposal with all 7 required arguments
        proposals[proposalCount] = Proposal(
            proposalCount,  // id
            _name,          // name
            _amount,        // amount
            _recipient,     // recipient
            0,              // votesFor
            0,              // votesAgainst
            false           // finalized
        );

        emit Propose(
            proposalCount,
            _amount,
            _recipient,
            msg.sender
        );
    }   


    function voteFor(uint256 _id) external onlyInvestor {
        _vote(_id, true);
    }

    function voteAgainst(uint256 _id) external onlyInvestor {
        _vote(_id, false);
    }

    function _vote(uint256 _id, bool _direction) internal {
        Proposal storage proposal = proposals[_id];

        require(!proposal.finalized, "Proposal already finalized");
        require(!hasVoted[msg.sender][_id], "Already voted");

        uint256 voteWeight = token.balanceOf(msg.sender);
        
        if (_direction) {
            proposal.votesFor += voteWeight;
        } else {
            proposal.votesAgainst += voteWeight;
        }

        hasVoted[msg.sender][_id] = true;
        voteDirection[msg.sender][_id] = _direction;

        emit Vote(_id, msg.sender, _direction);
    }

    function finalizeProposal(uint256 _id) external onlyInvestor {
        Proposal storage proposal = proposals[_id];

        require(!proposal.finalized, "Proposal already finalized");
        
        // Proposal passes if votes for >= quorum AND votes for > votes against
        require(proposal.votesFor >= quorum, "Must reach quorum to finalize proposal");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal must have more votes for than against");

        proposal.finalized = true;

        // Check that the contract has enough ether
        require(address(this).balance >= proposal.amount);

        // Transfer the funds to recipient
        (bool sent, ) = proposal.recipient.call{value: proposal.amount}("");
        require(sent);

        // Emit event
        emit Finalize(_id);
    }

}
