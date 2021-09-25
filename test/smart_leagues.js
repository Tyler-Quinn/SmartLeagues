const SmartLeagues = artifacts.require("SmartLeagues.sol");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("SmartLeagues", accounts => {
  let smartLeagues = null;
  before(async () => {
    smartLeagues = await SmartLeagues.deployed();
  });

  it('Should deploy smart contract properly', async () => {
    assert(smartLeagues.address != '');
  });

  it('Create league & check owner is msg.sender', async () => {
    let result = await smartLeagues.createLeague('test', {from: accounts[0]});
    assert(result.logs[0].args._owner === accounts[0]);
  });

  it('Check that a league name cannot be created twice', async () => {
    try {
      await smartLeagues.createLeague('test', {from: accounts[1]});
    } catch(e) {
      assert(e.message.includes('League name already exists'));
      return;
    }
    assert(false);
  });

  it('Cannot start round for a league that does not exist', async () => {
    try {
      await smartLeagues.startLeagueRound('NonexistentLeague', 200, 50, 8, 18, [60,40], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });

  it('Only league owner can start a league round', async () => {
    try {
      await smartLeagues.startLeagueRound('test', 200, 50, 8, 18, [60,40], {from: accounts[1]});
    } catch(e) {
      assert(e.message.includes('Only league owner can start a round'));
      return;
    }
    assert(false);
  });

  it('Cannot join a league that does not exist', async () => {
    try {
      await smartLeagues.joinLeagueRound('NonexistentLeague', 'Player1', false, {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });
});
