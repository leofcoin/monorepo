declare global {
    var transactionPoolStore: globalThis.LeofcoinStorage;
}
declare const _default: (config?: {
    network: string;
    networkName: string;
    networkVersion: string;
}) => Promise<void>;
export default _default;
