import { ContractMessage } from '@leofcoin/messages';
export { default as nodeConfig } from './node-config.js';
declare type address = string;
declare type transaction = {
    from: address;
    to: address;
    method: string;
    params: [];
    timestamp: Number;
};
declare type signedTransaction = {
    from: address;
    to: address;
    method: string;
    params: [];
    timestamp: Number;
};
declare type signable = {
    sign: (transaction: any) => Uint8Array;
};
export declare const contractFactoryMessage: string;
export declare const nativeTokenMessage: string;
export declare const nameServiceMessage: string;
export declare const validatorsMessage: string;
export declare const createContractMessage: (creator: any, contract: any, constructorParameters?: any[]) => Promise<ContractMessage>;
export declare const calculateFee: (transaction: any) => Promise<string | 0>;
export declare const calculateTransactionFee: (transaction: any) => Promise<string | 0>;
export declare const calculateReward: (validators: any, fees: any) => [];
export declare const createTransactionHash: (transaction: transaction) => Promise<Uint8Array>;
export declare const signTransaction: (transaction: transaction, wallet: signable) => Promise<signedTransaction>;
