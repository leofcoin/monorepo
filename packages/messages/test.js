import BlockMessage from "./exports/block.js";
import { ContractMessage } from "./exports/index.js";
import { BigNumber } from "@leofcoin/utils";

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
console.time('message encoded')
const message = await new BlockMessage(block)
console.timeEnd('message encoded')
console.time('normal encoded')
JSON.stringify(block)
console.timeEnd('normal encoded')
console.log(message.toHex());
console.log(message.encoded);
new BlockMessage(message.toBs58())
const contract = new ContractMessage(contractMessage.encode())