import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class BWRequestMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}