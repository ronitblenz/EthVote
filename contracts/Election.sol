pragma solidity >=0.4.20;

contract Election {
    // Model a Candidate
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
        bool exists;  // To track if candidate exists
    }

    // Store votes for each session
    mapping(uint => mapping(address => bool)) public votersBySession;
    // Current session ID
    uint public currentSession;
    // Store Candidates
    mapping(uint => Candidate) public candidates;
    // Store Candidates Count
    uint public candidatesCount;

    // voted event
    event votedEvent (
        uint indexed _candidateId,
        uint indexed _sessionId
    );

    // session change event
    event sessionChanged(
        uint indexed _newSessionId
    );

    // candidate events
    event candidateAdded(
        uint indexed _candidateId,
        string _name
    );

    event candidateUpdated(
        uint indexed _candidateId,
        string _newName
    );

    event candidateRemoved(
        uint indexed _candidateId
    );

    constructor() public {
        currentSession = 1; // Start with session 1
        // Add default candidates
        addCandidate("Candidate 1");
        addCandidate("Candidate 2");
    }

    function addCandidate(string memory _name) public {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, true);
        emit candidateAdded(candidatesCount, _name);
    }

    function updateCandidateName(uint _candidateId, string memory _newName) public {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        require(candidates[_candidateId].exists, "Candidate does not exist");
        require(bytes(_newName).length > 0, "New name cannot be empty");
        
        candidates[_candidateId].name = _newName;
        emit candidateUpdated(_candidateId, _newName);
    }

    function removeCandidate(uint _candidateId) public {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        require(candidates[_candidateId].exists, "Candidate does not exist");
        
        candidates[_candidateId].exists = false;
        emit candidateRemoved(_candidateId);
    }

    // Start a new voting session
    function startNewSession() public {
        // Reset all candidate vote counts
        for(uint i = 1; i <= candidatesCount; i++) {
            if (candidates[i].exists) {
                candidates[i].voteCount = 0;
            }
        }
        currentSession++;
        emit sessionChanged(currentSession);
    }

    function vote(uint _candidateId) public {
        require(!votersBySession[currentSession][msg.sender], "Already voted in this session");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate");
        require(candidates[_candidateId].exists, "Candidate has been removed");

        votersBySession[currentSession][msg.sender] = true;
        candidates[_candidateId].voteCount++;
        emit votedEvent(_candidateId, currentSession);
    }

    // Check if an address has voted in the current session
    function hasVoted(address _voter) public view returns(bool) {
        return votersBySession[currentSession][_voter];
    }

    // Get current session ID
    function getCurrentSession() public view returns(uint) {
        return currentSession;
    }

    // Check if candidate exists
    function candidateExists(uint _candidateId) public view returns(bool) {
        if (_candidateId <= 0 || _candidateId > candidatesCount) return false;
        return candidates[_candidateId].exists;
    }
}
