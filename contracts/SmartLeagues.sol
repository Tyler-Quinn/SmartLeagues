//SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

import "./@openzeppelin/contracts/access/Ownable.sol";
import "./@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SmartLeagues is ReentrancyGuard{
    constructor() {
    }

    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeMath for uint16;

    struct Player {
        address payable userAddress;
        string nickname;
        uint16[] holeScores;
        uint256 totalScore;
        bool scoresSubmitted;
        bool acePoolEntry;
        bool acePoolWin;
    }

    struct Round {
        Player[] player;
        uint256 balance;            // total balance of entry fees
        uint256 priceToJoin;
        uint256 priceAcePool;
        address[] acePoolWinners;   // contains all winners of the ace pool
        uint16 maxPlayers;          // max number of players allowed in the round
        uint16 finishedCount;       // how many have submitted scores
        uint16 numberOfHoles;       // used for player.holeScores array size 
        uint8[] payoutPercentage;   // 0-100 percentage of pool paid out to winners where [0] is first place, [1] is seconds place, etc.
                                    // any total percentage under 100, the leftover will be donated back to the league funds
    }

    struct League {
        bytes32 name;                               // name: hash of name of league input upon creation
        address owner;                              // owner: address that calls createLeague()
        uint256 balance;                            // totalBalance: total balance deposited in this league
        uint256 acePoolBalance;                     // acePoolBalance: total balance of current ace pool
        Round round;                                // round: holds active round data
        bool roundOpen;                             // roundOpen: 1 if there is an active round started that has not finished
    }
    
    event NewLeague(address indexed _owner, bytes32 indexed _leagueHash);
    //event NewRound(bytes32 indexed _leagueHash, Round indexed _roundData);
    //event PlayerJoinedRound(address indexed _player, string indexed _nickname, bytes32 indexed _leagueHash);

    mapping (bytes32 => League) internal nameToLeague;
    mapping (bytes32 => bool) internal leagueNames;
    mapping (address => bytes32) internal addressToLeagueRoundJoined;

    uint256 MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint16 MAX_UINT16 = 0xffff;

    modifier leagueExists(string memory _name) {
        require(leagueNames[keccak256(abi.encodePacked(_name))], "League name does not exist");
        _;
    }

    modifier leagueDoesNotExist(string memory _name) {
        require(!leagueNames[keccak256(abi.encodePacked(_name))], "League name already exists");
        _;
    }

    // can start a round if you are the league owner of this league 
    modifier startLeagueRoundAccess(string memory _leagueName) {
        require(nameToLeague[keccak256(abi.encodePacked(_leagueName))].owner == msg.sender, "Only league owner can start a round");
        _;
    }

    // allows function to run if msg.sender is not already part of this round
    modifier playerNotInRound(string memory _leagueName) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        for (uint16 i = 0; i < nameToLeague[nameHash].round.player.length; i++) {
            require(nameToLeague[nameHash].round.player[i].userAddress != msg.sender, "Address already included in the round");
        }
        _;
    }

    // allows function to run if msg.sender is part of this round
    modifier playerInRound(string memory _leagueName) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        for (uint16 i = 0; i < nameToLeague[nameHash].round.player.length; i++) {
            if (nameToLeague[nameHash].round.player[i].userAddress == msg.sender) {
                _;
            }
        }
        require(false, "Address is not included in the round");
    }
    
    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    function createLeague(string memory _name) external leagueDoesNotExist(_name) {
        bytes32 nameHash = keccak256(abi.encodePacked(_name));
        // if unique name, add to the leagueNames
        leagueNames[nameHash] = true;

         // hash input for league name
        nameToLeague[nameHash].name = nameHash;
        // make caller owner of this league
        nameToLeague[nameHash].owner = msg.sender;
        // initialize balances
        nameToLeague[nameHash].balance = 0;
        nameToLeague[nameHash].acePoolBalance = 0;
        
        // create new league event
        emit NewLeague(msg.sender, nameHash);
    }

    function startLeagueRound(
        string memory _leagueName,
        uint256 _priceToJoin,
        uint256 _priceAcePool,
        uint16 _maxPlayers,
        uint16 _numberOfHoles,
        uint8[] memory _payoutPercentage
    )
        external
        leagueExists(_leagueName)
        startLeagueRoundAccess(_leagueName)
    {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        // cannot start a round if a round is already in progress
        require(!nameToLeague[nameHash].roundOpen, "Round already open");
        // price to join must be positive
        require(_priceToJoin > 0, "Price to join must be positive, non-zero");
        // ace pool price must be non-negative
        require(_priceAcePool >= 0, "Ace pool price must be non-negative, set to zero if no ace pool");
        // amount of max players must be more than one
        require(_maxPlayers > 1, "Max number of players must be more than one");
        // number of holes needs to be positive non-zero
        require(_numberOfHoles > 0, "Need to have a positive non-zero number of holes for the round");
        // validate payout scheme
        uint8 _totalPayoutPercentage = 0;
        for (uint i = 0; (i < _payoutPercentage.length) && (_payoutPercentage[i] != 0); i++) {
            _totalPayoutPercentage += _payoutPercentage[i];
            require(_totalPayoutPercentage <= 100, "Payout scheme invalid, all places must be less than or equal to 100");
        }

        // if all requirements met, start the round
        nameToLeague[nameHash].roundOpen = true;
        // clear players array
        delete nameToLeague[nameHash].round.player;
        delete nameToLeague[nameHash].round.acePoolWinners;
        // set inputs to league round information
        nameToLeague[nameHash].round.priceToJoin = _priceToJoin;
        nameToLeague[nameHash].round.priceAcePool = _priceAcePool;
        nameToLeague[nameHash].round.maxPlayers = _maxPlayers;
        nameToLeague[nameHash].round.finishedCount = 0;
        nameToLeague[nameHash].round.numberOfHoles = _numberOfHoles;
        delete nameToLeague[nameHash].round.payoutPercentage;
        nameToLeague[nameHash].round.payoutPercentage = _payoutPercentage;
        
        // round data event
        //emit NewRound(nameHash, nameToLeague[nameHash].round);
    }

    function joinLeagueRound(
        string memory _leagueName,
        string memory _nickname,
        bool _joinAcePool
    )
        external
        payable
        leagueExists(_leagueName)
        playerNotInRound(_leagueName)
        nonReentrant()
    {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        // a round has to already have been started
        require(nameToLeague[nameHash].roundOpen, "A round has not been started");
        // make sure there is an available space in the round
        require(nameToLeague[nameHash].round.player.length < nameToLeague[nameHash].round.maxPlayers, "No more spots available");
        // create temporary player that will later be pushed to the round player array
        Player memory _player;
        _player.userAddress = payable(msg.sender);
        _player.nickname = _nickname;
        _player.scoresSubmitted = false;
        delete _player.holeScores;
        // ensure the player has sent enough funds to join the round
        if (_joinAcePool) {
            require(msg.value == SafeMath.add(nameToLeague[nameHash].round.priceToJoin, nameToLeague[nameHash].round.priceAcePool), "Incorrect funds to join round + ace pool");
            // adjust balances
            nameToLeague[nameHash].round.balance += nameToLeague[nameHash].round.priceToJoin;
            nameToLeague[nameHash].acePoolBalance += nameToLeague[nameHash].round.priceAcePool;
            // modify player data
            _player.acePoolEntry = true;
            // push player to round
            nameToLeague[nameHash].round.player.push(_player);
            // send funds to contract
            (bool sent,) = payable(address(this)).call{value: msg.value}("");
            require(sent, "Failed to send Ether");
        } else {
            require(msg.value == nameToLeague[nameHash].round.priceToJoin, "Incorrect funds to join round");
            // adjust balance
            nameToLeague[nameHash].round.balance += nameToLeague[nameHash].round.priceToJoin;
            // modify player data
            _player.acePoolEntry = false;
            // push player to round
            nameToLeague[nameHash].round.player.push(_player);
            // send funds to contract
            (bool sent,) = payable(address(this)).call{value: msg.value}("");
            require(sent, "Failed to send Ether");
        }

        //emit PlayerJoinedRound(msg.sender, _player.nickname, nameHash);
    }

    function submitScores(
        string memory _leagueName,
        uint16[] memory _holeScore
    )
        external
        payable
        leagueExists(_leagueName)
        nonReentrant
    {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        // league round must be open
        require(nameToLeague[nameHash].roundOpen, "There is no open round for this league");
        // get the index of the player in the round.player[] array; player must be in the array to continue
        uint16 _index = addressInRound(_leagueName, msg.sender);
        require(_index != MAX_UINT16, "Address is not included in this league's round");
        // require that this player has not already submitted their scores
        require(!nameToLeague[nameHash].round.player[_index].scoresSubmitted, "Scores already submitted");
        nameToLeague[nameHash].round.player[_index].scoresSubmitted = true;
        // The input _holeScore array size must be the same as the number of holes for the round
        require(_holeScore.length == nameToLeague[nameHash].round.numberOfHoles, "Invalid array size for hole scores");
        
        // copy hole score inputs to round.player data
        nameToLeague[nameHash].round.player[_index].holeScores = _holeScore;

        // move inputted hole scores to the league round data
        uint256 _scoreSum = 0;
        for (uint256 i = 0; i < nameToLeague[nameHash].round.numberOfHoles; i++) {
            // _scoreSum = SafeMath.add(uint256(nameToLeague[nameHash].round.player[_index].holeScores[i]), _scoreSum);
            _scoreSum = SafeMath.add(uint256(_holeScore[i]), _scoreSum);
            // if ace was had on this hole and player is in ace pool, set win ace pool 
            if (nameToLeague[nameHash].round.player[_index].acePoolEntry && _holeScore[i] == 1) {
                nameToLeague[nameHash].round.player[_index].acePoolWin;
                nameToLeague[nameHash].round.acePoolWinners.push(msg.sender);
            }
        }
        nameToLeague[nameHash].round.player[_index].totalScore = _scoreSum;

        // increment finished player count
        nameToLeague[nameHash].round.finishedCount++;
        // if the last player to finish, payout winners
        if (nameToLeague[nameHash].round.finishedCount == nameToLeague[nameHash].round.player.length) {
            payoutWinner(_leagueName);
        }
    }

    function payoutWinner(string memory _leagueName)
        internal
        leagueExists(_leagueName)
    {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        // league round must be open
        require(nameToLeague[nameHash].roundOpen, "There is no open round for this league");
        // when can payouts be done
        require(nameToLeague[nameHash].round.finishedCount == nameToLeague[nameHash].round.player.length, "Payout conditions not met");
        
        // calculate ace pool payout 
        uint256 _acePoolPayout = 0;
        if (nameToLeague[nameHash].round.acePoolWinners.length != 0) {
            _acePoolPayout = SafeMath.div(nameToLeague[nameHash].acePoolBalance, nameToLeague[nameHash].round.acePoolWinners.length);
        }

        // sort player array within round data, players sorted by score from low to high
        playerQuickSort(nameHash, 0, int(nameToLeague[nameHash].round.player.length - 1));

        uint256 _totalRoundBalance = nameToLeague[nameHash].round.balance;
        for (uint _payoutIndex = 0; (_payoutIndex < nameToLeague[nameHash].round.payoutPercentage.length) && (nameToLeague[nameHash].round.payoutPercentage[_payoutIndex] != 0); ) {
            // i is the index in the payout scheme
            // get number of tied players for this spot in the payout scheme
            uint16 _playersInPlaceCount = 1;
            while (nameToLeague[nameHash].round.player[_payoutIndex].totalScore == nameToLeague[nameHash].round.player[_payoutIndex + _playersInPlaceCount].totalScore) {
                _playersInPlaceCount++;
            }

            // get total percentage of payouts due to this group of players
            // if players are tied, the percent payouts get added together, divided by number of players tied, and distributed to all tied players
            // ex: if 2 players are tied for 1st, the payout percents of 1st and 2nd get added together and divided by 2, and both players get this percent
            uint16 _totalPlacePayoutPercentage = 0;
            for (uint16 j = 0; (j < _playersInPlaceCount) && (_payoutIndex + j < nameToLeague[nameHash].round.payoutPercentage.length); j++) {
                _totalPlacePayoutPercentage += nameToLeague[nameHash].round.payoutPercentage[_payoutIndex + j];
            }
            // get the percentage of the round balance that each player taking this place will receive
            // integer division means there may be left over funds after payouts, these are rolled into the league balance
            uint256 _percentPayoutForPlace = SafeMath.div(uint(_totalPlacePayoutPercentage), uint(_playersInPlaceCount));
            // get total amount paid for this place
            uint256 _amountPaid = SafeMath.mul(_percentPayoutForPlace, SafeMath.div(_totalRoundBalance, 100));

            // payout all players in this place
            for (uint16 j = 0; j < _playersInPlaceCount; j++) {
                // subtract from round balance
                require(nameToLeague[nameHash].round.balance >= _amountPaid, "Round balance not large enough to pay out");
                nameToLeague[nameHash].round.balance -= _amountPaid;
                if (nameToLeague[nameHash].round.player[_payoutIndex = j].acePoolWin) {
                    require(nameToLeague[nameHash].round.balance >= _acePoolPayout, "Ace pool balance not large enough to pay out");
                    nameToLeague[nameHash].acePoolBalance -= _acePoolPayout;
                    // send to address
                    (bool sent,) = nameToLeague[nameHash].round.player[_payoutIndex + j].userAddress.call{value: _amountPaid + _acePoolPayout}("");
                    require(sent, "Failed to send Ether");
                } else {
                    // send to address
                    (bool sent,) = nameToLeague[nameHash].round.player[_payoutIndex + j].userAddress.call{value: _amountPaid}("");
                    require(sent, "Failed to send Ether");
                }
            }

            // adjust player payout index to account for any ties before looping to next in line for payout check
            _payoutIndex += _playersInPlaceCount;
        }

        // move any leftover funds to the league's balance
        nameToLeague[nameHash].balance += nameToLeague[nameHash].round.balance;
        nameToLeague[nameHash].round.balance = 0;
        // close round
        nameToLeague[nameHash].roundOpen = false;
    }

    // submits max value as this msg.sender's total score so it will automatically be last place
    function forfeitRound(string memory _leagueName) external leagueExists(_leagueName) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        // league must have an open round
        require(nameToLeague[nameHash].roundOpen, "There is no open round for this league");
        // get the index of the player in the round.player[] array; player must be in the array to continue
        uint16 _index = addressInRound(_leagueName, msg.sender);
        require(_index != MAX_UINT16, "Address is not included in this league's round");
        // require that this player has not already submitted their scores
        require(!nameToLeague[nameHash].round.player[_index].scoresSubmitted, "Scores already submitted");
        nameToLeague[nameHash].round.player[_index].scoresSubmitted = true;

        nameToLeague[nameHash].round.player[_index].totalScore = MAX_UINT;

        // increment finished player count
        nameToLeague[nameHash].round.finishedCount++;
        // if the last player to finish, payout winners
        if (nameToLeague[nameHash].round.finishedCount == nameToLeague[nameHash].round.player.length) {
            payoutWinner(_leagueName);
        }
    }

    // returns the index in the round's player[] array; if address is not in the league it will return max value of uint16(65535) 
    function addressInRound(string memory _leagueName, address _addressCheck)
        internal
        view
        leagueExists(_leagueName)
        returns(uint16)
    {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        // loop through all players in the round and check if msg.sender is in the round
        for (uint16 i = 0; i < nameToLeague[nameHash].round.player.length; i++) {
            if(nameToLeague[nameHash].round.player[i].userAddress == _addressCheck) {
                return(i);
            }
        }
        return(MAX_UINT16);
    }

    function playerQuickSort(bytes32 _nameHash, int _left, int _right) internal {
        int _i = _left;
        int _j = _right;
        if(_i==_j) return;
        uint pivot = nameToLeague[_nameHash].round.player[uint(_left + (_right - _left) / 2)].totalScore;
        while (_i <= _j) {
            while (nameToLeague[_nameHash].round.player[uint(_i)].totalScore < pivot) _i++;
            while (pivot < nameToLeague[_nameHash].round.player[uint(_j)].totalScore) _j--;
            if (_i <= _j) {
                Player memory _tempPlayer = nameToLeague[_nameHash].round.player[uint(_i)];     // must copy to a temporary location to swap positions in array
                nameToLeague[_nameHash].round.player[uint(_i)] = nameToLeague[_nameHash].round.player[uint(_j)];
                nameToLeague[_nameHash].round.player[uint(_j)] = _tempPlayer;
                _i++;
                _j--;
            }
        }
        if (_left < _j)
            playerQuickSort(_nameHash, _left, _j);
        if (_i < _right)
            playerQuickSort(_nameHash, _i, _right);
    }
    
    function getNumberOfPlayers(string memory _leagueName) external view leagueExists(_leagueName) returns(uint16) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        require(nameToLeague[nameHash].roundOpen, "This league does not have a round open");
        return uint16(nameToLeague[nameHash].round.player.length);
    }
    
    function getLeagueBalance(string memory _leagueName) external view leagueExists(_leagueName) returns(uint256) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        return nameToLeague[nameHash].balance;
    }
    
    function getRoundBalance(string memory _leagueName) external view leagueExists(_leagueName) returns(uint256) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        require(nameToLeague[nameHash].roundOpen, "This league does not have a round open");
        return nameToLeague[nameHash].round.balance;
    }
    
    function getAcePoolBalance(string memory _leagueName) external view leagueExists(_leagueName) returns(uint256) {
        bytes32 nameHash = keccak256(abi.encodePacked(_leagueName));
        return nameToLeague[nameHash].acePoolBalance;
    }
}