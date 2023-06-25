import { TransactionMessage, RawTransactionMessage } from '@leofcoin/messages';
export { default as nodeConfig } from './node-config.js';
import '@vandeurenglenn/base58';
declare type address = string;
declare type rawTransaction = {
    from: address;
    to: address;
    method: string;
    params: any[];
    timestamp: Number;
};
declare type signedTransaction = {
    from: address;
    to: address;
    method: string;
    params: any[];
    timestamp: Number;
    signature: base58String;
};
declare type signable = {
    sign: (transaction: rawTransaction) => Uint8Array;
};
export declare const contractFactoryMessage: string;
export declare const nativeTokenMessage: string;
export declare const nameServiceMessage: string;
export declare const validatorsMessage: string;
export declare const createContractMessage: (creator: any, contract: any, constructorParameters?: any[]) => Promise<any>;
export declare const calculateFee: (transaction: any, format?: boolean) => Promise<any>;
export declare const calculateTransactionFee: (transaction: any) => Promise<any>;
export declare const calculateReward: (validators: any, fees: any) => [];
export declare const createTransactionHash: (transaction: rawTransaction | TransactionMessage | RawTransactionMessage) => Promise<Uint8Array>;
export declare const signTransaction: (transaction: rawTransaction, wallet: signable) => Promise<signedTransaction>;
export declare const prepareContractTransaction: (owner: any, contract: any, constructorParameters?: any[]) => Promise<rawTransaction>;
/**
 *
 * @param owner address
 * @param contract contract code
 * @param constructorParameters ...
 * @param wallet {sign}
 * @returns
 */
export declare const prepareContractTransactionAndSign: (owner: any, contract: any, constructorParameters: any[], wallet: any) => Promise<signedTransaction>;
