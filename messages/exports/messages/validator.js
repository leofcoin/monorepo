import { BigNumber } from '@leofcoin/utils';
import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
  address: String(),
  reward: BigNumber.from(0)
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
