# SmartLeagues

Do not fork without making significant changes.
I am aware security flaws, lack of gas optimization.

GOALS FOR PROJECT
First go at Solidity and Javascript.
Goal was to get comfortable programming in Solidity and Javascript, learn Truffle, writing test scripts.

PROJECT DESCRIPTION
Wanted to make a non-trivial escrow type contract for golf league managers to create and monitor leagues.
Handling buy in, score keeping, and payouts.

FUTURE UPGRADES
Need to rework the contracts to downsize the contract size.
Make the base structure more modular to easily add league and round type behaviors such as singles round, doubles league, doubles round game modes without repetitive implementation of very similar functions.
Some functions would be better handled off-chain.
Implement a pull payments approach and splits using 0xSplits.
