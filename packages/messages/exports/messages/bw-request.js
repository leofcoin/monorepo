import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
};

class BWRequestMessage extends FormatInterface {
    get messageName() {
        return 'BWRequestMessage';
    }
    constructor(buffer) {
        const name = 'bw-request-message';
        super(buffer, proto, { name });
    }
}

export { BWRequestMessage as default };
