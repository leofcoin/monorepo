'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var lotteryMaster = require('./lottery-master-297e5370.js');
require('path');
require('ethers');
require('lucky-numbers');
require('chalk');



exports.create = lotteryMaster.create;
exports["default"] = lotteryMaster.lotteryMaster;
exports.reveal = lotteryMaster.reveal;
