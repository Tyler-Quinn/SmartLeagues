//SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

import "./@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SmartLeaguesBase is ReentrancyGuard{
    constructor() {
    }

    mapping (address => uint) public winnings;

    uint256 MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint16 MAX_UINT16 = 0xffff;

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    function claimWinnings() external nonReentrant() {
        require(winnings[msg.sender] != 0, 'Nothnig to claim');
        uint256 payout = winnings[msg.sender];
        winnings[msg.sender] = 0;
        (bool sent,) = msg.sender.call{value: payout}("");
        require(sent, "Failed to send Ether");
    }
}