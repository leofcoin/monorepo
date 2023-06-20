import '../messages/block.js';
import '../messages/bw.js';
import '../messages/bw-request.js';
import '../messages/contract.js';
import '../messages/last-block.js';
import '../messages/last-block-request.js';
import TransactionMessage from '../messages/transaction.js';
import '../messages/validator.js';
import EasyWorker from '@vandeurenglenn/easy-worker';

globalThis.peernet = globalThis.peernet || {};
globalThis.contracts = {};
const worker = new EasyWorker();
worker.onmessage(async (transactions) => {
    globalThis.peernet.codecs = {
        'transaction-message': {
            codec: parseInt('746d', 16),
            hashAlg: 'keccak-256'
        }
    };
    transactions = await Promise.all(transactions.map(async (message) => (message instanceof TransactionMessage ? new Uint8Array(message.encoded) : new TransactionMessage({ ...message, signature: new Uint8Array(message.signature) }).encoded)));
    worker.postMessage(transactions);
});
