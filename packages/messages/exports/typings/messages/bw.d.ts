import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class BWMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}
