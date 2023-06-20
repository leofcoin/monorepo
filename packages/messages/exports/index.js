export { default as BlockMessage } from './messages/block.js';
export { default as BWMessage } from './messages/bw.js';
export { default as BWRequestMessage } from './messages/bw-request.js';
export { default as ContractMessage } from './messages/contract.js';
export { default as LastBlockMessage } from './messages/last-block.js';
export { default as LastBlockRequestMessage } from './messages/last-block-request.js';
export { default as TransactionMessage } from './messages/transaction.js';
import { FormatInterface } from '@leofcoin/codec-format-interface';
export { default as ValidatorMessage } from './messages/validator.js';

var proto = {
    timestamp: Number(),
    from: String(),
    to: String(),
    nonce: Number(),
    method: String(),
    params: Array()
};

class RawTransactionMessage extends FormatInterface {
    get messageName() {
        return 'RawTransactionMessage';
    }
    constructor(buffer) {
        const name = 'raw-transaction-message';
        super(buffer, proto, { name });
    }
}

export { RawTransactionMessage };
