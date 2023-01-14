import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
  address: String(),
  reward: Number()
};

class ValidatorMessage extends FormatInterface {
    get messageName() {
        return 'ValidatorMessage';
    }
    constructor(buffer) {
        const name = 'validator-message';
        super(buffer, proto, { name });
    }
}

export { ValidatorMessage as default };
