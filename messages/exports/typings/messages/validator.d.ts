import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class ValidatorMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}
