import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class ContractMessage extends FormatInterface {
    get messageName(): string;
    constructor(buffer: messageInput);
}