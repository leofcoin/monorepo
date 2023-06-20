import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class TransactionMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}
