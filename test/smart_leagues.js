const SmartLeagues = artifacts.require("SmartLeagues.sol");

const BN = require('bn.js');
const { assert } = require('console');

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
      await smartLeagues.joinLeagueRound('test', false, {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('A round has not been started'));
      return;
    }
    assert(false);
  });

  it ('Cannot forfeit a round in a league that does not exist', async () => {
    try {
      await smartLeagues.forfeitRound('NonexistentLeague');
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });

  it ('Cannot forfeit a round if a league does not have an open round', async () => {
    try {
      await smartLeagues.forfeitRound('test');
    } catch(e) {
      assert(e.message.includes('There is no open round for this league'));
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
      await smartLeagues.joinLeagueRound('NonexistentLeague', false, {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });

  it('Cannot join round if the amount sent to the contract does not match the priceToJoin (ace pool FALSE)', async () => {
    try {
      // price to join is 2 ether
      await smartLeagues.joinLeagueRound('test', false, {value: 20, from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Incorrect funds to join round'));
      return;
    }
    assert(false);
  });

  it('Cannot join round if the amount sent to the contract does not match the priceToJoin (ace pool TRUE)', async () => {
    try {
      // price to join is 2 ether, price for ace pool is 0.5 ether
      await smartLeagues.joinLeagueRound('test', true, {value: web3.utils.toWei('2', 'ether'), from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Incorrect funds to join round + ace pool'));
      return;
    }
    assert(false);
  });

  it('Player1 round (ace pool FALSE), ensure round variables are updated and funds are placed properly', async () => {
    // check pre join round round variables
    let result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.player.length == 0);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.acePoolBalance == 0);
    // join; price to join is 2 ether
    await smartLeagues.joinLeagueRound('test', false, {value: web3.utils.toWei('2', 'ether'), from: accounts[0]});
    // check post join round round variables
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.player.length == 1);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.balance == web3.utils.toWei('2', 'ether'));
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.acePoolBalance == 0);
  });

  it('Cannot join round with an address that has already joined the round', async () => {
    try {
      await smartLeagues.joinLeagueRound('test', false, {value: web3.utils.toWei('2', 'ether'), from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Address already included in the round'));
      return;
    }
    assert(false);
  });

  it('Player2 join round (ace pool TRUE), ensure round variables are updated and funds are placed properly', async () => {
    // check pre join round round variables
    let result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.player.length == 0);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.balance == web3.utils.toWei('2', 'ether'));
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.acePoolBalance == 0);
    // join; price to join is 2 ether
    await smartLeagues.joinLeagueRound('test', true, {value: web3.utils.toWei('2.5', 'ether'), from: accounts[1]});
    // check post join round round variables
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.player.length == 2);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.balance == web3.utils.toWei('4', 'ether'));
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.acePoolBalance == web3.utils.toWei('0.5', 'ether'));
  });

  it('Player3 join round (ace pool TRUE), ensure round variables are updated and funds are placed properly', async () => {
    // check pre join round round variables
    let result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.player.length == 2);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.balance == web3.utils.toWei('4', 'ether'));
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.acePoolBalance == web3.utils.toWei('0.5', 'ether'));
    // join; price to join is 2 ether
    await smartLeagues.joinLeagueRound('test', true, {value: web3.utils.toWei('2.5', 'ether'), from: accounts[2]});
    // check post join round round variables
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.player.length == 3);
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.balance == 0);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.balance == web3.utils.toWei('6', 'ether'));
    result = await smartLeagues.getLeagueInfo('test');
    assert(result.acePoolBalance == web3.utils.toWei('1', 'ether'));
  });

  it('Cannot join round if already at the max number of players', async () => {
    try {
      await smartLeagues.joinLeagueRound('test', false, {value: web3.utils.toWei('2', 'ether'), from: accounts[3]});
    } catch(e) {
      assert(e.message.includes('No more spots available'));
      return;
    }
    assert(false);
  });

  it ('Cannot forfeit a round if this address is not included in the round', async () => {
    try {
      await smartLeagues.forfeitRound('test', {from: accounts[5]});
    } catch(e) {
      assert(e.message.includes('Address is not included in this leagues round'));
      return;
    }
    assert(false);
  });

  it('Test getLeagueRoundPlayer getter', async () => {

  });

  it('Player3 successfully forfeits the round, check round variables', async () => {
    let index = await smartLeagues.addressInRound('test', accounts[2]);
    assert(index == 2);
    let result = await smartLeagues.getLeagueRoundPlayerInfo('test', accounts[2]);
    assert(!result.scoresSubmitted);
    await smartLeagues.forfeitRound('test', {from: accounts[2]});
    result = await smartLeagues.getLeagueRoundPlayerInfo('test', accounts[2]);
    assert(result.scoresSubmitted);
  });

  it('Cannot forfeit round if scores have already been submitted', async () => {
    try {
      await smartLeagues.forfeitRound('test', {from: accounts[2]});
    } catch(e) {
      assert(e.message.includes('Scores already submitted'));
      return;
    }
    assert(false);
  });
});