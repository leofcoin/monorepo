import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class LastBlockMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}
