import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
  timestamp: Number(),
  from: String(),
  to: String(),
  nonce: Number(),
  method: String(),
  params: Array(),
  signature: new Uint8Array()
};

class TransactionMessage extends FormatInterface {
    get messageName() {
        return 'TransactionMessage';
    }
    constructor(buffer) {
        const name = 'transaction-message';
        super(buffer, proto, { name });
    }
}

export { TransactionMessage as default };
