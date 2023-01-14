import { FormatInterface } from '@leofcoin/codec-format-interface';
export default class BlockMessage extends FormatInterface {
    decoded: {
        index: Number;
        previousHash: String;
        timestamp: String;
        reward: Number;
        fees: Number;
        transactions: Uint8Array[] | Object[] | Uint8Array;
        validators: Uint8Array[] | Object[] | Uint8Array;
    };
    get messageName(): string;
    constructor(buffer: messageInput);
    encode(): Uint8Array;
    decode(): {
        index: Number;
        previousHash: String;
        timestamp: String;
        reward: Number;
        fees: Number;
        transactions: Uint8Array | Uint8Array[] | Object[];
        validators: Uint8Array | Uint8Array[] | Object[];
    };
}
