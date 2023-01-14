import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
  creator: String(),
  contract: new Uint8Array(),
  constructorParameters: Array()
};

class ContractMessage extends FormatInterface {
    get messageName() {
        return 'ContractMessage';
    }
    constructor(buffer) {
        super(buffer, proto, { name: 'contract-message' });
    }
}

export { ContractMessage as default };
