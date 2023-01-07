declare type options = {
    wordlist?: string[];
};
export default class Mnemonic {
    wordlist: string[];
    constructor(options: options);
    lpad(string: string, padString: string, length: number): string;
    normalize(string: string): string;
    bytesToBinary(bytes: number[]): string;
    deriveChecksumBits(entropyBuffer: Uint8Array): Promise<string>;
    mnemonicFromEntropy(entropyBuffer: Uint8Array): Promise<string>;
    generate(strength?: number): Promise<string>;
    salt(password: string): string;
    seedFromMnemonic(mnemonic: string, password: string, strength?: number, iterations?: number): Promise<ArrayBuffer>;
}
export {};
