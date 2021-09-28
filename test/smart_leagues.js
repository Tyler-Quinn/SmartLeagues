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

  it ('Round price must be greater than zero', async () => {
    try {
      await smartLeagues.startLeagueRound('test', 0, 50, 8, 18, [60,40], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Price to join must be positive, non-zero'));
      return;
    }
    assert(false);
  });

  it ('Max players must be greater than one', async () => {
    try {
      await smartLeagues.startLeagueRound('test', 200, 50, 0, 18, [60,40], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Max number of players must be more than one'));
      return;
    }
    assert(false);
  });

  it ('Round needs to have a non-zero number of holes', async () => {
    try {
      await smartLeagues.startLeagueRound('test', 200, 50, 8, 0, [60,40], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Need to have a positive non-zero number of holes for the round'));
      return;
    }
    assert(false);
  });

  it ('Sum of the payment scheme array must not excede 100', async () => {
    try {
      await smartLeagues.startLeagueRound('test', 200, 50, 8, 18, [60,60], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Payout scheme invalid, all places must be less than or equal to 100'));
      return;
    }
    assert(false);
  });

  it ('Cannot join a round in a league that does not have an open round', async () => {
    try {
      await smartLeagues.joinLeagueRound('test', 'Player1', false, {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('A round has not been started'));
      return;
    }
    assert(false);
  });

  it ('Start round then check there is a round open by trying to start another (cannot open two rounds in the same league)', async () => {
    await smartLeagues.startLeagueRound('test', web3.utils.toWei('2', 'ether'), web3.utils.toWei('0.5', 'ether'), 3, 3, [60,40], {from: accounts[0]});
    try {
      await smartLeagues.startLeagueRound('test', web3.utils.toWei('2', 'ether'), web3.utils.toWei('0.5', 'ether'), 3, 3, [60,40], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Round already open'));
      return;
    }
    assert(false);
  });

  it('Cannot join a round for a league that does not exist', async () => {
    try {
      await smartLeagues.joinLeagueRound('NonexistentLeague', 'Player1', false, {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });

  it('Cannot join round if the amount sent to the contract does not match the priceToJoin (ace pool FALSE)', async () => {
    try {
      // price to join is 2 ether
      await smartLeagues.joinLeagueRound('test', 'Player1', false, {value: 20, from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Incorrect funds to join round'));
      return;
    }
    assert(false);
  });

  it('Cannot join round if the amount sent to the contract does not match the priceToJoin (ace pool TRUE)', async () => {
    try {
      // price to join is 2 ether, price for ace pool is 0.5 ether
      await smartLeagues.joinLeagueRound('test', 'Player1', true, {value: web3.utils.toWei('2', 'ether'), from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Incorrect funds to join round + ace pool'));
      return;
    }
    assert(false);
  });

  it('Join round, ensure round variables are updated and funds are placed properly', async () => {
    // check pre join round round variables
    let result = await smartLeagues.getNumberOfPlayers('test');
    let b = (result == 0);
    result = await smartLeagues.getLeagueBalance('test');
    b = b && (result == 0);
    result = await smartLeagues.getRoundBalance('test');
    b = b && (result == 0);
    result = await smartLeagues.getAcePoolBalance('test');
    b = b && (result == 0);
    // join; price to join is 2 ether
    await smartLeagues.joinLeagueRound('test', 'Player1', false, {value: web3.utils.toWei('2', 'ether'), from: accounts[0]});
    // check post join round round variables
    result = await smartLeagues.getNumberOfPlayers('test');
    b = b && (result == 1);
    result = await smartLeagues.getLeagueBalance('test');
    b = b && (result == 0);
    result = await smartLeagues.getRoundBalance('test');
    b = b && (result == web3.utils.toWei('2', 'ether'));
    result = await smartLeagues.getAcePoolBalance('test');
    b = b && (result == 0);
    assert(b);
  });
});
