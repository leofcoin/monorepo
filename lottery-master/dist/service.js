'use strict';

var lotteryMaster = require('./lottery-master-297e5370.js');
var ethers = require('ethers');
var chalk = require('chalk');
require('lucky-numbers');
require('path');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var ethers__default = /*#__PURE__*/_interopDefaultLegacy(ethers);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);

const run = async () => {
  let tx;
  const contract = new ethers__default["default"].Contract(lotteryMaster.lotteryMaster.addresses.lotteryProxy, lotteryMaster.ABI, lotteryMaster.lotteryMaster.signer);
  const currentLottery = await contract.latestLottery();
  const currenTime = Math.round(new Date().getTime() / 1000);
  if (currentLottery.endTime < currenTime && currentLottery.status === 1) {
    try {
      tx = await lotteryMaster.lotteryMaster.reveal(currentLottery.id);
      await tx.wait();
      console.log(chalk__default["default"].green(`Revealed winningNumbers ${currentLottery.id}`));
    } catch (e) {
      console.log(chalk__default["default"].red(`Failed Revealing winningNumbers ${currentLottery.id}`));
    }
    try {
      tx = await lotteryMaster.lotteryMaster.create();
      await tx.wait();
      console.log(chalk__default["default"].green(`Created lottery ${Number(currentLottery.id) + 1}`));
    } catch (e) {
      console.log(chalk__default["default"].red(`Failed creating lottery ${Number(currentLottery.id) + 1}`));
    }
  }
  setTimeout(() => {
    run();
  }, 60000);
};



run();
