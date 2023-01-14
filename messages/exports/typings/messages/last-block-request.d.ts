import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class LastBlockRequestMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}
