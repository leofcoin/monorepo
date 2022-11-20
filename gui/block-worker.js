'use strict';

var codecFormatInterface = require('@leofcoin/codec-format-interface');
var bignumber = require('@ethersproject/bignumber');
require('@ethersproject/units');
var EasyWorker = require('@vandeurenglenn/easy-worker');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var EasyWorker__default = /*#__PURE__*/_interopDefaultLegacy(EasyWorker);

var proto = `
message ValidatorMessage {
  required string address = 1;
  required string reward = 2;
}

message Transaction {
  required string hash = 1;
  required uint64 timestamp = 2;
  required string from = 3;
  required string to = 4;
  required uint64 nonce = 5;
  required string method = 6;
  repeated string params = 7;
}

message BlockMessage {
  required uint64 index = 1;
  required string previousHash = 3;
  required uint64 timestamp = 4;
  required uint64 reward = 5;
  required string fees = 6;
  repeated Transaction transactions = 7;
  repeated ValidatorMessage validators = 8;
}
`;

class BlockMessage extends codecFormatInterface.FormatInterface {
  get keys() {
    return ['index', 'previousHash', 'timestamp', 'reward', 'fees', 'transactions', 'validators']
  }

  get messageName() {
    return 'BlockMessage'
  }

  constructor(buffer) {
    const name = 'block-message';
    super(buffer, proto, {name});
  }
}

const byteFormats = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  if (decimals < 0) decimals = 0;

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${byteFormats[i]}`
};

const worker = new EasyWorker__default["default"]();

globalThis.BigNumber = bignumber.BigNumber;

globalThis.peernet = globalThis.peernet || {};
globalThis.contracts = {};

const run = async (blocks) => {  
  blocks = await Promise.all(blocks.map(block => new BlockMessage(block)));
  blocks = blocks.sort((a, b) => a.decoded.timestamp - b.decoded.timestamp);

  blocks = await Promise.all(blocks.map(block => new Promise(async (resolve, reject) => {
    // todo: tx worker or nah?
    const size = block.encoded.length || block.encoded.byteLength;
    console.log(`loaded block: ${await block.hash} @${block.decoded.index} ${formatBytes(size)}`);
    resolve(block);
  })));
  return blocks
};

const tasks = async blocks => {
  globalThis.peernet.codecs =  {
    'block-message': {
      codec: parseInt('626d', 16),
      hashAlg: 'keccak-256'
    }
  };  
  
  blocks = await run(blocks);
  worker.postMessage(blocks);
};
 

worker.onmessage(data => tasks(data));
