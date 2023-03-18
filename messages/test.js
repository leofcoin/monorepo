import BlockMessage from "./exports/messages/block.js";
import BWRequestMessage from "./exports/messages/bw-request.js";
import { ContractMessage } from "./exports/index.js";
import { BigNumber } from "@leofcoin/utils";

console.log(globalThis.peernet);
// globalThis.peernet.codecs
const validators = [{
  address: 'address',
  reward: new BigNumber.from(0)
}]

const transactions = []
for (let i = 0; i <= 1; i++) {
  transactions.push(
    {
      timestamp: new Date().getTime(),
      from: 'fromAddress',
      to: 'toAddress',
      nonce: 0,
      method: 'getAddress',
      params: [],
      signature: new Uint8Array(32)
    }
  )
}

const block = {
  index: 0,
  previousHash: 'hash',
  timestamp: new Date().getTime(),
  reward: new BigNumber.from('0'),
  fees: new BigNumber.from('0'),
  transactions,
  validators
}
const contractMessage = new ContractMessage({
  creator: 'aaa',
  contract: new Uint8Array(),
  constructorParameters: []
})

const message = new BlockMessage(block)
console.time('message encoded')
console.timeEnd('message encoded')
console.time('normal encoded')
console.timeEnd('normal encoded')

const contract = new ContractMessage(contractMessage.encoded)