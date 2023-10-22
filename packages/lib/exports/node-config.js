import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage, ValidatorMessage } from '@leofcoin/messages';

var nodeConfig = async (config = {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'v1.0.0'
}) => {
    await peernet.addProto('contract-message', ContractMessage);
    await peernet.addProto('transaction-message', TransactionMessage);
    await peernet.addProto('block-message', BlockMessage);
    await peernet.addProto('bw-message', BWMessage);
    await peernet.addProto('bw-request-message', BWRequestMessage);
    await peernet.addProto('validator-message', ValidatorMessage);
    let name = `.${config.network}`;
    const parts = config.network.split(':');
    if (parts[1])
        name = `.${parts[0]}/${parts[1]}`;
    await peernet.addStore('contract', 'lfc', name, false);
    await peernet.addStore('accounts', 'lfc', name, false);
    await peernet.addStore('transactionPool', 'lfc', name, false);
};

export { nodeConfig as default };
