import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
};

class LastBlockRequestMessage extends FormatInterface {
    get messageName() {
        return 'LastBlockRequestMessage';
    }
    constructor(buffer) {
        const name = 'last-block-request-message';
        super(buffer, proto, { name });
    }
}

export { LastBlockRequestMessage as default };
