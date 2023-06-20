import { ContractMessage } from '@leofcoin/messages';
export declare const nodeConfig: (config?: {
    network: string;
    networkName: string;
    networkVersion: string;
}) => Promise<void>;
export declare const contractFactoryMessage: string;
export declare const nativeTokenMessage: string;
export declare const nameServiceMessage: string;
export declare const validatorsMessage: string;
export declare const createContractMessage: (creator: any, contract: any, constructorParameters?: any[]) => Promise<ContractMessage>;
export declare const calculateFee: (transaction: any) => Promise<string | 0>;
export declare const calculateTransactionFee: (transaction: any) => Promise<string | 0>;
export declare const calculateReward: (validators: any, fees: any) => [];
