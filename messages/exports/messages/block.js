import { BigNumber } from '@leofcoin/utils';
import { FormatInterface } from '@leofcoin/codec-format-interface';
import TransactionMessage from './transaction.js';
import ValidatorMessage from './validator.js';
import smartConcat from '@vandeurenglenn/typed-array-smart-concat';
import smartDeconcat from '@vandeurenglenn/typed-array-smart-deconcat';

var proto = {
  index: Number(),
  previousHash: String(),
  timestamp: Number(),
  reward: BigNumber.from(0),
  fees: BigNumber.from(0),
  transactions: new Uint8Array(),
  validators: new Uint8Array()
};

class BlockMessage extends FormatInterface {
    get messageName() {
        return 'BlockMessage';
    }
    constructor(buffer) {
        const name = 'block-message';
        super(buffer, proto, { name });
    }
    encode() {
        const decoded = this.decoded;
        const validators = [];
        const transactions = [];
        for (const validator of decoded.validators) {
            if (validator instanceof ValidatorMessage)
                validators.push(validator.encoded);
            else
                validators.push(new ValidatorMessage(validator).encoded);
        }
        for (const transaction of decoded.transactions) {
            if (transaction instanceof TransactionMessage)
                transactions.push(transaction.encoded);
            else
                transactions.push(new TransactionMessage(transaction).encoded);
        }
        return super.encode({
            ...decoded,
            validators: smartConcat(validators),
            transactions: smartConcat(transactions)
        });
    }
    decode() {
        super.decode();
        this.decoded.transactions = smartDeconcat(this.decoded.transactions).map(transaction => new TransactionMessage(transaction).decoded);
        this.decoded.validators = smartDeconcat(this.decoded.validators).map(validator => new ValidatorMessage(validator).decoded);
        return this.decoded;
    }
}

export { BlockMessage as default };
