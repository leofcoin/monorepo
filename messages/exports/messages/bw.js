import { FormatInterface } from '@leofcoin/codec-format-interface';

var proto = {
  up: Number(),
  down: Number()
};

class BWMessage extends FormatInterface {
    get messageName() {
        return 'BWMessage';
    }
    constructor(buffer) {
        const name = 'bw-message';
        super(buffer, proto, { name });
    }
}

export { BWMessage as default };
