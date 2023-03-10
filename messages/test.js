import BlockMessage from "./exports/messages/block.js";
import BWRequestMessage from "./exports/messages/bw-request.js";
import { ContractMessage } from "./exports/index.js";
import { BigNumber } from "@leofcoin/utils";

console.log(globalThis.peernet);
// globalThis.peernet.codecs
const validators = [{
  address: 'address',
  reward: 0
}]

const transactions = []
for (let i = 0; i <= 1_235; i++) {
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
console.log({contractMessage});
const bw = new BWRequestMessage()

const message = new BlockMessage(block)
console.log({reward: message.decoded.reward});
console.time('message encoded')
console.log(await message.hash());
await message.encode()
console.log(await message.hash());
console.log({reward: new BlockMessage(message.encoded).decoded.reward});
console.log(await new BlockMessage(message.encoded).hash());
console.timeEnd('message encoded')
console.time('normal encoded')
const normalEncoded = new TextEncoder().encode(JSON.stringify(block))
console.timeEnd('normal encoded')

console.log('# is smaller then normal encoded');
console.info(`normal: ${normalEncoded.length}\nmessage: ${message.encoded.length}`);
console.log(normalEncoded.length > message.encoded.length);

const contract = new ContractMessage(contractMessage.encoded)
console.log(contract);