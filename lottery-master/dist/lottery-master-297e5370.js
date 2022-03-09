'use strict';

require('lucky-numbers');
var ethers = require('ethers');
require('chalk');
var path = require('path');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var ethers__default = /*#__PURE__*/_interopDefaultLegacy(ethers);

var ABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"lotteryId","type":"uint256"},{"indexed":false,"internalType":"uint256[]","name":"numbers","type":"uint256[]"},{"indexed":false,"internalType":"uint256","name":"totalCost","type":"uint256"}],"name":"BuyTickets","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"previous","type":"address"},{"indexed":false,"internalType":"address","name":"current","type":"address"}],"name":"ChangeManager","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newMaxRange","type":"uint256"}],"name":"ChangeMaxRange","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"lotteryId","type":"uint256"},{"indexed":false,"internalType":"uint256[]","name":"winningNumbers","type":"uint256[]"},{"indexed":false,"internalType":"uint256","name":"burns","type":"uint256"}],"name":"LotteryClose","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"lotteryId","type":"uint256"}],"name":"LotteryOpen","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newLotterySize","type":"uint256"}],"name":"UpdateLotterySize","type":"event"},{"inputs":[],"name":"_lotterySize","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"_maxValidRange","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"maxRange_","type":"uint256"}],"name":"setMaxRange","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"maxRange","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"lotteryTicketsAddress_","type":"address"}],"name":"changeLotteryTicketsNFT","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"artOnline_","type":"address"}],"name":"changeArtOnline","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"lotterySize_","type":"uint256"}],"name":"setLotterySize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"lotterySize","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"manager_","type":"address"}],"name":"changeManager","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"lotteries","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id_","type":"uint256"}],"name":"lottery","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum LotteryStorage.Status","name":"status","type":"uint8"},{"internalType":"uint256","name":"prizePool","type":"uint256"},{"internalType":"uint256","name":"ticketPrice","type":"uint256"},{"internalType":"uint256[]","name":"prizeDistribution","type":"uint256[]"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256[]","name":"winningNumbers","type":"uint256[]"},{"internalType":"string","name":"proof","type":"string"}],"internalType":"struct LotteryStorage.lottoInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"topUp","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"startTime_","type":"uint256"},{"internalType":"uint256","name":"endTime_","type":"uint256"},{"internalType":"uint256","name":"_costPerTicket","type":"uint256"},{"internalType":"uint256[]","name":"_prizeDistribution","type":"uint256[]"}],"name":"createLottery","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"lottery_","type":"uint256"},{"internalType":"uint256[]","name":"winningNumbers_","type":"uint256[]"},{"internalType":"string","name":"proof","type":"string"}],"name":"revealWinningNumbers","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id_","type":"uint256"},{"internalType":"uint256","name":"tickets","type":"uint256"},{"internalType":"uint256[]","name":"numbers_","type":"uint256[]"}],"name":"buyTickets","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"latestLottery","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum LotteryStorage.Status","name":"status","type":"uint8"},{"internalType":"uint256","name":"prizePool","type":"uint256"},{"internalType":"uint256","name":"ticketPrice","type":"uint256"},{"internalType":"uint256[]","name":"prizeDistribution","type":"uint256[]"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256[]","name":"winningNumbers","type":"uint256[]"},{"internalType":"string","name":"proof","type":"string"}],"internalType":"struct LotteryStorage.lottoInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"timestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"_lotteryId","type":"uint256"},{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"_lotteryId","type":"uint256"},{"internalType":"uint256[]","name":"_tokenIds","type":"uint256[]"}],"name":"batchClaimRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount_","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}];

var _reveal = async (addresses, provider, signer, lottery) => {
  const contract = new ethers__default["default"].Contract(addresses.lotteryProxy, ABI, signer);
  const numbers = lottery(6, 9);
  const proof = await signer.signMessage(Buffer.from(numbers));
  console.log(numbers);
  try {
    await contract.revealWinningNumbers(lottery, numbers, proof);
    // logger.info(`created lottery`)
  } catch (e) {
    console.warn(e);
    // logger.info(e)
  } finally {

  }
};

var ART = [{"inputs":[{"internalType":"address","name":"platform_","type":"address"},{"internalType":"uint256","name":"cap_","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MINT_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PAUSER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"percentSettings","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newPlatform","type":"address"}],"name":"setPlatform","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"platform","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"cap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burnPercentage","outputs":[{"internalType":"uint256","name":"percentage","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"}];

var _create = async (addresses, provider, signer, ticketPrice = ethers__default["default"].utils.parseUnits('1000', 18), startDelay = 60, duration = 3600, pot = 100000) => {

  const date = new Date();
  date.getFullYear();
  date.getMonth();
  date.getDate();
  date.getHours();
  date.getMinutes();
  date.getSeconds();
  const UTCDate = Math.round(Math.round(new Date().getTime()) / 1000);

  const contract = new ethers__default["default"].Contract(addresses.lotteryProxy, ABI, signer);
  const startTime = UTCDate + startDelay;
  const endTime = UTCDate + duration; // 2 hours
  const distribution = [ethers__default["default"].BigNumber.from('2'), ethers__default["default"].BigNumber.from('3'), ethers__default["default"].BigNumber.from('5'), ethers__default["default"].BigNumber.from('10'), ethers__default["default"].BigNumber.from('30'), ethers__default["default"].BigNumber.from('50')];
  const artOnline = new ethers__default["default"].Contract(addresses.artonline, ART, signer);
  let balance = await artOnline.balanceOf(addresses.lotteryProxy);
  balance = ethers__default["default"].utils.formatUnits(balance);
  balance = Math.round(Number(balance.toString()));

  console.log(balance);
  let tx;
  if (balance === 0) {

    tx = await artOnline.mint(addresses.lotteryProxy, ethers__default["default"].utils.parseUnits(String(pot)));
    await tx.wait();
  } else if (balance < pot) {
    tx = await artOnline.mint(addresses.lotteryProxy, ethers__default["default"].utils.parseUnits(String(pot - balance)));
    await tx.wait();
  }
  return contract.createLottery(startTime, endTime, ticketPrice, distribution, {gasLimit: 21000000})
};

const dotenv = require('dotenv').config();
const config = dotenv.parsed;

const network = 'binance-smartchain-testnet';

const rpcUrls =  {
  'art-ganache': 'http://127.0.0.1:1337',
  'binance-smartchain-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
  'binance-smartchain': 'https://bsc-dataseed.binance.org'
};
const chainIds =  {
  'art-ganache': 1337,
  'binance-smartchain-testnet': 97,
  'binance-smartchain': 56
};

let addresses = require(path.join(__dirname, `./../../addresses/addresses/${network}.json`));

const provider = new ethers__default["default"].providers.JsonRpcProvider( rpcUrls[network], {
  chainId: chainIds[network]
});
// 127.0.0.1:1337

const signer = new ethers__default["default"].Wallet(config.TEST_PRIVATEKEY, provider);

const reveal = async (
  ticketPrice = ethers__default["default"].utils.parseUnits('1000', 18),
  startDelay = 60,
  duration = 3600,
  pot = 100000
) => _reveal(addresses, provider, signer, ticketPrice);

const create = async () => _create(addresses, provider, signer);

var lotteryMaster = {
  addresses,
  reveal,
  create,
  ethers: ethers__default["default"],
  signer
};

exports.ABI = ABI;
exports.create = create;
exports.lotteryMaster = lotteryMaster;
exports.reveal = reveal;
