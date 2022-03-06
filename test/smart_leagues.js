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
    assert(result.player.length == 1);
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

  it('Player3 submits scores and check player state variables', async () => {
    try {
      await smartLeagues.submitScores('test', [3,3,6], {from: accounts[2]});
    } catch(e) {
      assert(false);
      return;
    }
    let result = await smartLeagues.getLeagueRoundPlayerInfo('test', accounts[2]);
    assert(result.scoresSubmitted);
    assert(!result.acePoolWin);
    assert(JSON.stringify(result.holeScores) == JSON.stringify(['3','3','6']));
    assert(result.totalScore == 12);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.finishedCount == 1);
  });

  it('Cannot submit scores to a league that does not exist', async () => {
    try {
      await smartLeagues.submitScores('NonexistentLeague', [3,3,4], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });

  it('Cannot submit scores if this address is not included in the round', async () => {
    try {
      await smartLeagues.submitScores('test', [3,3,4], {from: accounts[4]});
    } catch(e) {
      assert(e.message.includes('Address is not included in this leagues round'));
      return;
    }
    assert(false);
  });

  it('Cannot submit scores if this address has already submitted scores', async () => {
    try {
      await smartLeagues.submitScores('test', [3,3,4], {from: accounts[2]});
    } catch(e) {
      assert(e.message.includes('Scores already submitted'));
      return;
    }
    assert(false);
  });

  it('Cannot submit scores if array size does not match number of holes in round', async () => {
    try {
      await smartLeagues.submitScores('test', [3,3,3,3], {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Invalid array size for hole scores'));
      return;
    }
    assert(false);
  });

  it('Submit scores and check player state variables', async () => {
    try {
      await smartLeagues.submitScores('test', [3,3,4], {from: accounts[0]});
    } catch(e) {
      assert(false);
      return;
    }
    let result = await smartLeagues.getLeagueRoundPlayerInfo('test', accounts[0]);
    assert(result.scoresSubmitted);
    assert(!result.acePoolWin);
    assert(JSON.stringify(result.holeScores) == JSON.stringify(['3','3','4']));
    assert(result.totalScore == 10);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.finishedCount == 2);
  });

  it('Cannot call payouts for a league that does not exist', async () => {
    try {
      await smartLeagues.finishRound('NonexistentLeauge', {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('League name does not exist'));
      return;
    }
    assert(false);
  });

  it('Cannot call payouts if not the league owner', async () => {
    try {
      await smartLeagues.finishRound('test', {from: accounts[1]});
    } catch(e) {
      assert(e.message.includes('Only the league owner can call payout'));
      return;
    }
    assert(false);
  });

  it('Cannot call payouts if not all players have submitted scores', async () => {
    try {
      await smartLeagues.finishRound('test', {from: accounts[0]});
    } catch(e) {
      assert(e.message.includes('Payout conditions not met'));
      return;
    }
    assert(false);
  });

  it('Final player submits scores; check player state variables', async () => {
    try {
      await smartLeagues.submitScores('test', [3,3,2], {from: accounts[1]});
    } catch(e) {
      assert(false);
      return;
    }
    let result = await smartLeagues.getLeagueRoundPlayerInfo('test', accounts[1]);
    assert(result.scoresSubmitted);
    assert(!result.acePoolWin);
    assert(JSON.stringify(result.holeScores) == JSON.stringify(['3','3','2']));
    assert(result.totalScore == 8);
    result = await smartLeagues.getLeagueRoundInfo('test');
    assert(result.finishedCount == 3);
  });

  // All players have now submitted scores
  
  it('Submit scores, check player balances and league state variables', async () => {
    try {
      let result = await smartLeagues.getLeagueRoundInfo('test');
      await smartLeagues.finishRound('test', {from: accounts[0]});
    } catch(e) {
      console.log(e.message);
      assert(false);
      return;
    }
    result = await smartLeagues.winnings(accounts[1]);
    assert(result == web3.utils.toWei('3.6', 'ether'));
    result = await smartLeagues.winnings(accounts[0]);
    assert(result == web3.utils.toWei('2.4', 'ether'));
    result = await smartLeagues.winnings(accounts[2]);
    assert(result == 0);
    result = await smartLeagues.getLeagueInfo('test');
    // round no longer open
    assert(!result.roundOpen);
    // no left over to pool to the league balance
    assert(result.balance == 0);
    // ace pool should remain in league info
    assert(result.acePoolBalance = web3.utils.toWei('1', 'ether'));
  });

  // Successfully settled a league round

  it('Cannot claim winnings if there are no winnings for this address', async () => {
    try {
      await smartLeagues.claimWinnings({from: accounts[2]});
    } catch(e) {
      assert(e.message.includes('Nothnig to claim'));
      return;
    }
    assert(false);
  });

  it('Player1 claims their winnings which updates their account balance', async () => {
    let initialBalance = await web3.eth.getBalance(accounts[0]);
    try {
      await smartLeagues.claimWinnings({from: accounts[0]});
    } catch(e) {
      assert(false);
      return;
    }
    let targetBalance = eval(initialBalance) + eval(web3.utils.toWei('3.6', 'ether'));
    let result = await web3.eth.getBalance(accounts[0]);
    assert((result > initialBalance) && (result < targetBalance));  // result will be less than targetBalance due to gas fee of calling claimWinnings
  });
});
