const Election = artifacts.require("./Election.sol");

contract("Election", (accounts) => {
  let electionInstance;

  it("initializes with two candidates", async () => {
    electionInstance = await Election.deployed();
    const count = await electionInstance.candidatesCount();
    assert.equal(count.toNumber(), 2, "Should initialize with 2 candidates");
  });

  it("initializes the candidates with the correct values", async () => {
    electionInstance = await Election.deployed();

    const candidate1 = await electionInstance.candidates(1);
    assert.equal(candidate1[0].toNumber(), 1, "contains the correct id for candidate 1");
    assert.equal(candidate1[1], "Candidate 1", "contains the correct name for candidate 1");
    assert.equal(candidate1[2].toNumber(), 0, "contains the correct votes count for candidate 1");

    const candidate2 = await electionInstance.candidates(2);
    assert.equal(candidate2[0].toNumber(), 2, "contains the correct id for candidate 2");
    assert.equal(candidate2[1], "Candidate 2", "contains the correct name for candidate 2");
    assert.equal(candidate2[2].toNumber(), 0, "contains the correct votes count for candidate 2");
  });

  it("allows a voter to cast a vote", async () => {
    electionInstance = await Election.deployed();
    const candidateId = 1;

    const receipt = await electionInstance.vote(candidateId, { from: accounts[0] });
    assert.equal(receipt.logs.length, 1, "an event was triggered");
    assert.equal(receipt.logs[0].event, "votedEvent", "the event type is correct");
    assert.equal(receipt.logs[0].args._candidateId.toNumber(), candidateId, "the candidate id is correct");

    const voted = await electionInstance.voters(accounts[0]);
    assert(voted, "the voter was marked as voted");

    const candidate = await electionInstance.candidates(candidateId);
    const voteCount = candidate[2].toNumber();
    assert.equal(voteCount, 1, "increments the candidate's vote count");
  });

  it("throws an exception for invalid candidates", async () => {
    electionInstance = await Election.deployed();

    try {
      await electionInstance.vote(99, { from: accounts[1] });
      assert.fail("Expected revert not received");
    } catch (error) {
      assert(error.message.includes("revert"), "error message must contain revert");
    }

    // Check that votes did not change
    const candidate1 = await electionInstance.candidates(1);
    assert.equal(candidate1[2].toNumber(), 1, "candidate 1 did not receive any additional votes");

    const candidate2 = await electionInstance.candidates(2);
    assert.equal(candidate2[2].toNumber(), 0, "candidate 2 did not receive any votes");
  });

  it("throws an exception for double voting", async () => {
    electionInstance = await Election.deployed();
    const candidateId = 2;

    // First vote
    await electionInstance.vote(candidateId, { from: accounts[1] });
    let candidate = await electionInstance.candidates(candidateId);
    assert.equal(candidate[2].toNumber(), 1, "accepts first vote");

    // Attempt to vote again
    try {
      await electionInstance.vote(candidateId, { from: accounts[1] });
      assert.fail("Expected revert not received");
    } catch (error) {
      assert(error.message.includes("revert"), "error message must contain revert");
    }

    // Confirm that votes haven't changed
    const candidate1 = await electionInstance.candidates(1);
    assert.equal(candidate1[2].toNumber(), 1, "candidate 1 did not receive any additional votes");

    const candidate2 = await electionInstance.candidates(2);
    assert.equal(candidate2[2].toNumber(), 1, "candidate 2 did not receive any additional votes");
  });
});
