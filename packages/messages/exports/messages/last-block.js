import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
  hash: String(),
  index: Number()
};

class LastBlockMessage extends FormatInterface {
    get messageName() {
        return 'LastBlockMessage';
    }
    constructor(buffer) {
        const name = 'last-block-message';
        super(buffer, proto, { name });
    }
}

export { LastBlockMessage as default };
