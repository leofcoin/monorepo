import { ContractMessage, TransactionMessage, RawTransactionMessage } from '@leofcoin/messages';
import { validators as validators$1, contractFactory as contractFactory$1 } from '@leofcoin/addresses';
export { default as nodeConfig } from './node-config.js';
import { parseUnits, formatUnits } from '@leofcoin/utils';
import { toBase58 } from '@vandeurenglenn/typed-array-utils';
import '@vandeurenglenn/base58';

var contractFactory = "237,198,141,3,53,89,84,113,119,88,110,55,76,101,103,89,119,65,109,100,117,75,88,119,116,83,52,118,52,100,97,114,113,66,84,81,82,76,90,106,50,57,117,106,112,114,98,104,52,119,121,76,106,112,56,50,87,106,173,5,99,108,97,115,115,32,70,97,99,116,111,114,121,123,35,110,97,109,101,61,34,65,114,116,79,110,108,105,110,101,67,111,110,116,114,97,99,116,70,97,99,116,111,114,121,34,59,35,116,111,116,97,108,67,111,110,116,114,97,99,116,115,61,48,59,35,99,111,110,116,114,97,99,116,115,61,91,93,59,99,111,110,115,116,114,117,99,116,111,114,40,115,116,97,116,101,41,123,115,116,97,116,101,38,38,40,116,104,105,115,46,35,99,111,110,116,114,97,99,116,115,61,115,116,97,116,101,46,99,111,110,116,114,97,99,116,115,44,116,104,105,115,46,35,116,111,116,97,108,67,111,110,116,114,97,99,116,115,61,115,116,97,116,101,46,116,111,116,97,108,67,111,110,116,114,97,99,116,115,41,125,103,101,116,32,115,116,97,116,101,40,41,123,114,101,116,117,114,110,123,116,111,116,97,108,67,111,110,116,114,97,99,116,115,58,116,104,105,115,46,35,116,111,116,97,108,67,111,110,116,114,97,99,116,115,44,99,111,110,116,114,97,99,116,115,58,116,104,105,115,46,35,99,111,110,116,114,97,99,116,115,125,125,103,101,116,32,110,97,109,101,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,110,97,109,101,125,103,101,116,32,99,111,110,116,114,97,99,116,115,40,41,123,114,101,116,117,114,110,91,46,46,46,116,104,105,115,46,35,99,111,110,116,114,97,99,116,115,93,125,103,101,116,32,116,111,116,97,108,67,111,110,116,114,97,99,116,115,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,116,111,116,97,108,67,111,110,116,114,97,99,116,115,125,105,115,82,101,103,105,115,116,101,114,101,100,40,97,100,100,114,101,115,115,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,99,111,110,116,114,97,99,116,115,46,105,110,99,108,117,100,101,115,40,97,100,100,114,101,115,115,41,125,97,115,121,110,99,32,114,101,103,105,115,116,101,114,67,111,110,116,114,97,99,116,40,97,100,100,114,101,115,115,41,123,105,102,40,97,119,97,105,116,32,109,115,103,46,115,116,97,116,105,99,67,97,108,108,40,97,100,100,114,101,115,115,44,34,104,97,115,82,111,108,101,34,44,91,109,115,103,46,115,101,110,100,101,114,44,34,79,87,78,69,82,34,93,41,44,116,104,105,115,46,35,99,111,110,116,114,97,99,116,115,46,105,110,99,108,117,100,101,115,40,97,100,100,114,101,115,115,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,97,108,114,101,97,100,121,32,114,101,103,105,115,116,101,114,101,100,34,41,59,116,104,105,115,46,35,116,111,116,97,108,67,111,110,116,114,97,99,116,115,43,61,49,44,116,104,105,115,46,35,99,111,110,116,114,97,99,116,115,46,112,117,115,104,40,97,100,100,114,101,115,115,41,125,125,114,101,116,117,114,110,32,70,97,99,116,111,114,121,59,2,91,93";
var nativeToken = "237,198,141,3,53,89,84,113,119,88,110,55,76,101,103,89,119,65,109,100,117,75,88,119,116,83,52,118,52,100,97,114,113,66,84,81,82,76,90,106,50,57,117,106,112,114,98,104,52,119,121,76,106,112,56,50,87,106,163,26,99,108,97,115,115,32,82,111,108,101,115,123,35,114,111,108,101,115,61,123,79,87,78,69,82,58,91,93,44,77,73,78,84,58,91,93,44,66,85,82,78,58,91,93,125,59,99,111,110,115,116,114,117,99,116,111,114,40,114,111,108,101,115,41,123,105,102,40,114,111,108,101,115,41,123,105,102,40,33,40,114,111,108,101,115,32,105,110,115,116,97,110,99,101,111,102,32,79,98,106,101,99,116,41,41,116,104,114,111,119,32,110,101,119,32,84,121,112,101,69,114,114,111,114,40,34,101,120,112,101,99,116,101,100,32,114,111,108,101,115,32,116,111,32,98,101,32,97,110,32,111,98,106,101,99,116,34,41,59,116,104,105,115,46,35,114,111,108,101,115,61,123,46,46,46,114,111,108,101,115,44,46,46,46,116,104,105,115,46,35,114,111,108,101,115,125,125,101,108,115,101,32,116,104,105,115,46,35,103,114,97,110,116,82,111,108,101,40,109,115,103,46,115,101,110,100,101,114,44,34,79,87,78,69,82,34,41,125,103,101,116,32,115,116,97,116,101,40,41,123,114,101,116,117,114,110,123,114,111,108,101,115,58,116,104,105,115,46,114,111,108,101,115,125,125,103,101,116,32,114,111,108,101,115,40,41,123,114,101,116,117,114,110,123,46,46,46,116,104,105,115,46,35,114,111,108,101,115,125,125,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,114,101,116,117,114,110,33,33,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,38,38,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,105,110,99,108,117,100,101,115,40,97,100,100,114,101,115,115,41,125,35,103,114,97,110,116,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,96,36,123,114,111,108,101,125,32,114,111,108,101,32,97,108,114,101,97,100,121,32,103,114,97,110,116,101,100,32,102,111,114,32,36,123,97,100,100,114,101,115,115,125,96,41,59,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,112,117,115,104,40,97,100,100,114,101,115,115,41,125,35,114,101,118,111,107,101,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,96,36,123,114,111,108,101,125,32,114,111,108,101,32,97,108,114,101,97,100,121,32,114,101,118,111,107,101,100,32,102,111,114,32,36,123,97,100,100,114,101,115,115,125,96,41,59,105,102,40,34,79,87,78,69,82,34,61,61,61,114,111,108,101,38,38,49,61,61,61,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,108,101,110,103,116,104,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,97,116,108,101,97,115,116,32,111,110,101,32,111,119,110,101,114,32,105,115,32,110,101,101,100,101,100,33,34,41,59,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,115,112,108,105,99,101,40,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,105,110,100,101,120,79,102,40,97,100,100,114,101,115,115,41,41,125,103,114,97,110,116,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,34,79,87,78,69,82,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,78,111,116,32,97,108,108,111,119,101,100,34,41,59,116,104,105,115,46,35,103,114,97,110,116,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,125,114,101,118,111,107,101,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,34,79,87,78,69,82,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,78,111,116,32,97,108,108,111,119,101,100,34,41,59,116,104,105,115,46,35,114,101,118,111,107,101,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,125,125,99,108,97,115,115,32,84,111,107,101,110,32,101,120,116,101,110,100,115,32,82,111,108,101,115,123,35,110,97,109,101,59,35,115,121,109,98,111,108,59,35,104,111,108,100,101,114,115,61,48,59,35,98,97,108,97,110,99,101,115,61,123,125,59,35,97,112,112,114,111,118,97,108,115,61,123,125,59,35,100,101,99,105,109,97,108,115,61,49,56,59,35,116,111,116,97,108,83,117,112,112,108,121,61,66,105,103,78,117,109,98,101,114,46,102,114,111,109,40,48,41,59,99,111,110,115,116,114,117,99,116,111,114,40,110,97,109,101,44,115,121,109,98,111,108,44,100,101,99,105,109,97,108,115,61,49,56,44,115,116,97,116,101,41,123,105,102,40,33,110,97,109,101,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,97,109,101,32,117,110,100,101,102,105,110,101,100,34,41,59,105,102,40,33,115,121,109,98,111,108,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,115,121,109,98,111,108,32,117,110,100,101,102,105,110,101,100,34,41,59,115,117,112,101,114,40,115,116,97,116,101,63,46,114,111,108,101,115,41,44,116,104,105,115,46,35,110,97,109,101,61,110,97,109,101,44,116,104,105,115,46,35,115,121,109,98,111,108,61,115,121,109,98,111,108,44,116,104,105,115,46,35,100,101,99,105,109,97,108,115,61,100,101,99,105,109,97,108,115,125,103,101,116,32,115,116,97,116,101,40,41,123,114,101,116,117,114,110,123,46,46,46,115,117,112,101,114,46,115,116,97,116,101,44,104,111,108,100,101,114,115,58,116,104,105,115,46,104,111,108,100,101,114,115,44,98,97,108,97,110,99,101,115,58,116,104,105,115,46,98,97,108,97,110,99,101,115,44,97,112,112,114,111,118,97,108,115,58,123,46,46,46,116,104,105,115,46,35,97,112,112,114,111,118,97,108,115,125,44,116,111,116,97,108,83,117,112,112,108,121,58,116,104,105,115,46,116,111,116,97,108,83,117,112,112,108,121,125,125,103,101,116,32,116,111,116,97,108,83,117,112,112,108,121,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,116,111,116,97,108,83,117,112,112,108,121,125,103,101,116,32,110,97,109,101,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,110,97,109,101,125,103,101,116,32,115,121,109,98,111,108,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,115,121,109,98,111,108,125,103,101,116,32,104,111,108,100,101,114,115,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,104,111,108,100,101,114,115,125,103,101,116,32,98,97,108,97,110,99,101,115,40,41,123,114,101,116,117,114,110,123,46,46,46,116,104,105,115,46,35,98,97,108,97,110,99,101,115,125,125,109,105,110,116,40,116,111,44,97,109,111,117,110,116,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,109,115,103,46,115,101,110,100,101,114,44,34,77,73,78,84,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,116,32,97,108,108,111,119,101,100,34,41,59,116,104,105,115,46,35,116,111,116,97,108,83,117,112,112,108,121,61,116,104,105,115,46,35,116,111,116,97,108,83,117,112,112,108,121,46,97,100,100,40,97,109,111,117,110,116,41,44,116,104,105,115,46,35,105,110,99,114,101,97,115,101,66,97,108,97,110,99,101,40,116,111,44,97,109,111,117,110,116,41,125,98,117,114,110,40,102,114,111,109,44,97,109,111,117,110,116,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,109,115,103,46,115,101,110,100,101,114,44,34,66,85,82,78,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,116,32,97,108,108,111,119,101,100,34,41,59,116,104,105,115,46,35,116,111,116,97,108,83,117,112,112,108,121,61,116,104,105,115,46,35,116,111,116,97,108,83,117,112,112,108,121,46,115,117,98,40,97,109,111,117,110,116,41,44,116,104,105,115,46,35,100,101,99,114,101,97,115,101,66,97,108,97,110,99,101,40,102,114,111,109,44,97,109,111,117,110,116,41,125,35,98,101,102,111,114,101,84,114,97,110,115,102,101,114,40,102,114,111,109,44,116,111,44,97,109,111,117,110,116,41,123,105,102,40,33,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,102,114,111,109,93,124,124,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,102,114,111,109,93,60,97,109,111,117,110,116,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,97,109,111,117,110,116,32,101,120,99,101,101,100,115,32,98,97,108,97,110,99,101,34,41,125,35,117,112,100,97,116,101,72,111,108,100,101,114,115,40,97,100,100,114,101,115,115,44,112,114,101,118,105,111,117,115,66,97,108,97,110,99,101,41,123,34,48,120,48,48,34,61,61,61,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,46,116,111,72,101,120,83,116,114,105,110,103,40,41,63,116,104,105,115,46,35,104,111,108,100,101,114,115,45,61,49,58,34,48,120,48,48,34,33,61,61,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,46,116,111,72,101,120,83,116,114,105,110,103,40,41,38,38,34,48,120,48,48,34,61,61,61,112,114,101,118,105,111,117,115,66,97,108,97,110,99,101,46,116,111,72,101,120,83,116,114,105,110,103,40,41,38,38,40,116,104,105,115,46,35,104,111,108,100,101,114,115,43,61,49,41,125,35,105,110,99,114,101,97,115,101,66,97,108,97,110,99,101,40,97,100,100,114,101,115,115,44,97,109,111,117,110,116,41,123,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,124,124,40,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,61,66,105,103,78,117,109,98,101,114,46,102,114,111,109,40,48,41,41,59,99,111,110,115,116,32,112,114,101,118,105,111,117,115,66,97,108,97,110,99,101,61,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,59,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,61,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,46,97,100,100,40,97,109,111,117,110,116,41,44,116,104,105,115,46,35,117,112,100,97,116,101,72,111,108,100,101,114,115,40,97,100,100,114,101,115,115,44,112,114,101,118,105,111,117,115,66,97,108,97,110,99,101,41,125,35,100,101,99,114,101,97,115,101,66,97,108,97,110,99,101,40,97,100,100,114,101,115,115,44,97,109,111,117,110,116,41,123,99,111,110,115,116,32,112,114,101,118,105,111,117,115,66,97,108,97,110,99,101,61,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,59,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,61,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,46,115,117,98,40,97,109,111,117,110,116,41,44,116,104,105,115,46,35,117,112,100,97,116,101,72,111,108,100,101,114,115,40,97,100,100,114,101,115,115,44,112,114,101,118,105,111,117,115,66,97,108,97,110,99,101,41,125,98,97,108,97,110,99,101,79,102,40,97,100,100,114,101,115,115,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,98,97,108,97,110,99,101,115,91,97,100,100,114,101,115,115,93,125,115,101,116,65,112,112,114,111,118,97,108,40,111,112,101,114,97,116,111,114,44,97,109,111,117,110,116,41,123,99,111,110,115,116,32,111,119,110,101,114,61,109,115,103,46,115,101,110,100,101,114,59,116,104,105,115,46,35,97,112,112,114,111,118,97,108,115,91,111,119,110,101,114,93,124,124,40,116,104,105,115,46,35,97,112,112,114,111,118,97,108,115,91,111,119,110,101,114,93,61,123,125,41,44,116,104,105,115,46,35,97,112,112,114,111,118,97,108,115,91,111,119,110,101,114,93,91,111,112,101,114,97,116,111,114,93,61,97,109,111,117,110,116,125,97,112,112,114,111,118,101,100,40,111,119,110,101,114,44,111,112,101,114,97,116,111,114,44,97,109,111,117,110,116,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,97,112,112,114,111,118,97,108,115,91,111,119,110,101,114,93,91,111,112,101,114,97,116,111,114,93,61,61,61,97,109,111,117,110,116,125,116,114,97,110,115,102,101,114,40,102,114,111,109,44,116,111,44,97,109,111,117,110,116,41,123,97,109,111,117,110,116,61,66,105,103,78,117,109,98,101,114,46,102,114,111,109,40,97,109,111,117,110,116,41,44,116,104,105,115,46,35,98,101,102,111,114,101,84,114,97,110,115,102,101,114,40,102,114,111,109,44,116,111,44,97,109,111,117,110,116,41,44,116,104,105,115,46,35,100,101,99,114,101,97,115,101,66,97,108,97,110,99,101,40,102,114,111,109,44,97,109,111,117,110,116,41,44,116,104,105,115,46,35,105,110,99,114,101,97,115,101,66,97,108,97,110,99,101,40,116,111,44,97,109,111,117,110,116,41,125,125,99,108,97,115,115,32,65,114,116,79,110,108,105,110,101,32,101,120,116,101,110,100,115,32,84,111,107,101,110,123,99,111,110,115,116,114,117,99,116,111,114,40,115,116,97,116,101,41,123,115,117,112,101,114,40,34,65,114,116,79,110,108,105,110,101,34,44,34,65,82,84,34,44,49,56,44,115,116,97,116,101,41,125,125,114,101,116,117,114,110,32,65,114,116,79,110,108,105,110,101,59,2,91,93";
var nameService = "237,198,141,3,53,89,84,113,119,88,110,55,76,101,103,89,119,65,109,100,117,75,88,119,116,83,52,118,52,100,97,114,113,66,84,81,82,76,90,106,50,57,117,106,112,114,98,104,52,119,121,76,106,112,56,50,87,106,131,13,99,108,97,115,115,32,78,97,109,101,83,101,114,118,105,99,101,123,35,110,97,109,101,61,34,65,114,116,79,110,108,105,110,101,78,97,109,101,83,101,114,118,105,99,101,34,59,35,111,119,110,101,114,59,35,112,114,105,99,101,61,48,59,35,114,101,103,105,115,116,114,121,61,123,125,59,35,99,117,114,114,101,110,99,121,59,103,101,116,32,110,97,109,101,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,110,97,109,101,125,103,101,116,32,114,101,103,105,115,116,114,121,40,41,123,114,101,116,117,114,110,123,46,46,46,116,104,105,115,46,35,114,101,103,105,115,116,114,121,125,125,103,101,116,32,115,116,97,116,101,40,41,123,114,101,116,117,114,110,123,111,119,110,101,114,58,116,104,105,115,46,35,111,119,110,101,114,44,114,101,103,105,115,116,114,121,58,116,104,105,115,46,35,114,101,103,105,115,116,114,121,44,99,117,114,114,101,110,99,121,58,116,104,105,115,46,35,99,117,114,114,101,110,99,121,44,112,114,105,99,101,58,116,104,105,115,46,35,112,114,105,99,101,125,125,99,111,110,115,116,114,117,99,116,111,114,40,102,97,99,116,111,114,121,65,100,100,114,101,115,115,44,99,117,114,114,101,110,99,121,44,118,97,108,105,100,97,116,111,114,65,100,100,114,101,115,115,44,112,114,105,99,101,44,115,116,97,116,101,41,123,115,116,97,116,101,63,40,116,104,105,115,46,35,111,119,110,101,114,61,115,116,97,116,101,46,111,119,110,101,114,44,116,104,105,115,46,35,114,101,103,105,115,116,114,121,61,115,116,97,116,101,46,114,101,103,105,115,116,114,121,44,116,104,105,115,46,35,99,117,114,114,101,110,99,121,61,115,116,97,116,101,46,99,117,114,114,101,110,99,121,44,116,104,105,115,46,35,112,114,105,99,101,61,115,116,97,116,101,46,112,114,105,99,101,41,58,40,116,104,105,115,46,35,111,119,110,101,114,61,109,115,103,46,115,101,110,100,101,114,44,116,104,105,115,46,35,112,114,105,99,101,61,112,114,105,99,101,44,116,104,105,115,46,35,114,101,103,105,115,116,114,121,46,65,114,116,79,110,108,105,110,101,67,111,110,116,114,97,99,116,70,97,99,116,111,114,121,61,123,111,119,110,101,114,58,109,115,103,46,115,101,110,100,101,114,44,97,100,100,114,101,115,115,58,102,97,99,116,111,114,121,65,100,100,114,101,115,115,125,44,116,104,105,115,46,35,114,101,103,105,115,116,114,121,46,65,114,116,79,110,108,105,110,101,84,111,107,101,110,61,123,111,119,110,101,114,58,109,115,103,46,115,101,110,100,101,114,44,97,100,100,114,101,115,115,58,99,117,114,114,101,110,99,121,125,44,116,104,105,115,46,35,114,101,103,105,115,116,114,121,46,65,114,116,79,110,108,105,110,101,86,97,108,105,100,97,116,111,114,115,61,123,111,119,110,101,114,58,109,115,103,46,115,101,110,100,101,114,44,97,100,100,114,101,115,115,58,118,97,108,105,100,97,116,111,114,65,100,100,114,101,115,115,125,44,116,104,105,115,46,35,99,117,114,114,101,110,99,121,61,99,117,114,114,101,110,99,121,41,125,99,104,97,110,103,101,79,119,110,101,114,40,111,119,110,101,114,41,123,105,102,40,109,115,103,46,115,101,110,100,101,114,33,61,61,116,104,105,115,46,35,111,119,110,101,114,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,32,111,119,110,101,114,34,41,59,116,104,105,115,46,35,111,119,110,101,114,61,111,119,110,101,114,125,99,104,97,110,103,101,80,114,105,99,101,40,112,114,105,99,101,41,123,105,102,40,109,115,103,46,115,101,110,100,101,114,33,61,61,116,104,105,115,46,35,111,119,110,101,114,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,32,111,119,110,101,114,34,41,59,116,104,105,115,46,35,112,114,105,99,101,61,112,114,105,99,101,125,99,104,97,110,103,101,67,117,114,114,101,110,99,121,40,99,117,114,114,101,110,99,121,41,123,105,102,40,109,115,103,46,115,101,110,100,101,114,33,61,61,116,104,105,115,46,35,111,119,110,101,114,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,32,111,119,110,101,114,34,41,59,116,104,105,115,46,35,99,117,114,114,101,110,99,121,61,99,117,114,114,101,110,99,121,125,97,115,121,110,99,32,112,117,114,99,104,97,115,101,78,97,109,101,40,110,97,109,101,44,97,100,100,114,101,115,115,41,123,105,102,40,97,119,97,105,116,32,109,115,103,46,99,97,108,108,40,116,104,105,115,46,35,99,117,114,114,101,110,99,121,44,34,98,97,108,97,110,99,101,79,102,34,44,91,109,115,103,46,115,101,110,100,101,114,93,41,60,116,104,105,115,46,35,112,114,105,99,101,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,112,114,105,99,101,32,101,120,99,101,101,100,115,32,98,97,108,97,110,99,101,34,41,59,116,114,121,123,97,119,97,105,116,32,109,115,103,46,99,97,108,108,40,116,104,105,115,46,35,99,117,114,114,101,110,99,121,44,34,116,114,97,110,115,102,101,114,34,44,91,109,115,103,46,115,101,110,100,101,114,44,116,104,105,115,46,35,111,119,110,101,114,44,116,104,105,115,46,35,112,114,105,99,101,93,41,125,99,97,116,99,104,40,101,114,114,111,114,41,123,116,104,114,111,119,32,101,114,114,111,114,125,116,104,105,115,46,35,114,101,103,105,115,116,114,121,91,110,97,109,101,93,61,123,111,119,110,101,114,58,109,115,103,46,115,101,110,100,101,114,44,97,100,100,114,101,115,115,58,97,100,100,114,101,115,115,125,125,108,111,111,107,117,112,40,110,97,109,101,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,114,101,103,105,115,116,114,121,91,110,97,109,101,93,125,116,114,97,110,115,102,101,114,79,119,110,101,114,115,104,105,112,40,110,97,109,101,44,116,111,41,123,105,102,40,109,115,103,46,115,101,110,100,101,114,33,61,61,116,104,105,115,46,35,114,101,103,105,115,116,114,121,91,110,97,109,101,93,46,111,119,110,101,114,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,116,32,97,32,111,119,110,101,114,34,41,59,116,104,105,115,46,35,114,101,103,105,115,116,114,121,91,110,97,109,101,93,46,111,119,110,101,114,61,116,111,125,99,104,97,110,103,101,65,100,100,114,101,115,115,40,110,97,109,101,44,97,100,100,114,101,115,115,41,123,105,102,40,109,115,103,46,115,101,110,100,101,114,33,61,61,116,104,105,115,46,35,114,101,103,105,115,116,114,121,91,110,97,109,101,93,46,111,119,110,101,114,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,116,32,97,32,111,119,110,101,114,34,41,59,116,104,105,115,46,35,114,101,103,105,115,116,114,121,91,110,97,109,101,93,46,97,100,100,114,101,115,115,61,97,100,100,114,101,115,115,125,125,114,101,116,117,114,110,32,78,97,109,101,83,101,114,118,105,99,101,59,212,1,91,34,73,72,78,89,50,71,81,71,89,79,54,66,68,88,72,72,76,50,75,72,75,51,75,81,85,51,53,51,72,80,67,65,82,85,86,65,80,50,85,86,87,72,52,69,85,86,86,52,74,88,84,51,55,51,75,83,86,70,50,34,44,34,73,72,78,89,50,71,81,72,51,67,52,52,82,82,85,68,77,52,88,76,71,54,55,75,72,72,83,51,85,69,82,55,76,54,78,85,76,68,72,72,54,65,67,86,79,65,86,84,76,65,71,66,82,76,66,53,66,83,74,34,44,34,73,72,78,89,50,71,81,72,70,75,84,86,69,66,74,71,82,84,54,88,71,72,82,52,51,52,75,87,76,71,68,72,79,86,69,73,52,79,66,54,85,75,55,81,85,75,67,78,79,73,67,77,86,84,88,82,87,84,83,34,44,34,49,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,48,34,93";
var validators = "237,198,141,3,53,89,84,113,119,88,110,55,76,101,103,89,119,65,109,100,117,75,88,119,116,83,52,118,52,100,97,114,113,66,84,81,82,76,90,106,50,57,117,106,112,114,98,104,52,119,121,76,106,112,56,50,87,106,164,28,99,108,97,115,115,32,82,111,108,101,115,123,35,114,111,108,101,115,61,123,79,87,78,69,82,58,91,93,44,77,73,78,84,58,91,93,44,66,85,82,78,58,91,93,125,59,99,111,110,115,116,114,117,99,116,111,114,40,114,111,108,101,115,41,123,105,102,40,114,111,108,101,115,41,123,105,102,40,33,40,114,111,108,101,115,32,105,110,115,116,97,110,99,101,111,102,32,79,98,106,101,99,116,41,41,116,104,114,111,119,32,110,101,119,32,84,121,112,101,69,114,114,111,114,40,34,101,120,112,101,99,116,101,100,32,114,111,108,101,115,32,116,111,32,98,101,32,97,110,32,111,98,106,101,99,116,34,41,59,116,104,105,115,46,35,114,111,108,101,115,61,123,46,46,46,114,111,108,101,115,44,46,46,46,116,104,105,115,46,35,114,111,108,101,115,125,125,101,108,115,101,32,116,104,105,115,46,35,103,114,97,110,116,82,111,108,101,40,109,115,103,46,115,101,110,100,101,114,44,34,79,87,78,69,82,34,41,125,103,101,116,32,115,116,97,116,101,40,41,123,114,101,116,117,114,110,123,114,111,108,101,115,58,116,104,105,115,46,114,111,108,101,115,125,125,103,101,116,32,114,111,108,101,115,40,41,123,114,101,116,117,114,110,123,46,46,46,116,104,105,115,46,35,114,111,108,101,115,125,125,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,114,101,116,117,114,110,33,33,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,38,38,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,105,110,99,108,117,100,101,115,40,97,100,100,114,101,115,115,41,125,35,103,114,97,110,116,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,96,36,123,114,111,108,101,125,32,114,111,108,101,32,97,108,114,101,97,100,121,32,103,114,97,110,116,101,100,32,102,111,114,32,36,123,97,100,100,114,101,115,115,125,96,41,59,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,112,117,115,104,40,97,100,100,114,101,115,115,41,125,35,114,101,118,111,107,101,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,96,36,123,114,111,108,101,125,32,114,111,108,101,32,97,108,114,101,97,100,121,32,114,101,118,111,107,101,100,32,102,111,114,32,36,123,97,100,100,114,101,115,115,125,96,41,59,105,102,40,34,79,87,78,69,82,34,61,61,61,114,111,108,101,38,38,49,61,61,61,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,108,101,110,103,116,104,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,97,116,108,101,97,115,116,32,111,110,101,32,111,119,110,101,114,32,105,115,32,110,101,101,100,101,100,33,34,41,59,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,115,112,108,105,99,101,40,116,104,105,115,46,35,114,111,108,101,115,91,114,111,108,101,93,46,105,110,100,101,120,79,102,40,97,100,100,114,101,115,115,41,41,125,103,114,97,110,116,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,34,79,87,78,69,82,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,78,111,116,32,97,108,108,111,119,101,100,34,41,59,116,104,105,115,46,35,103,114,97,110,116,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,125,114,101,118,111,107,101,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,97,100,100,114,101,115,115,44,34,79,87,78,69,82,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,78,111,116,32,97,108,108,111,119,101,100,34,41,59,116,104,105,115,46,35,114,101,118,111,107,101,82,111,108,101,40,97,100,100,114,101,115,115,44,114,111,108,101,41,125,125,99,108,97,115,115,32,86,97,108,105,100,97,116,111,114,115,32,101,120,116,101,110,100,115,32,82,111,108,101,115,123,35,110,97,109,101,61,34,65,114,116,79,110,108,105,110,101,86,97,108,105,100,97,116,111,114,115,34,59,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,61,48,59,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,61,48,59,35,118,97,108,105,100,97,116,111,114,115,61,123,125,59,35,99,117,114,114,101,110,99,121,59,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,59,103,101,116,32,115,116,97,116,101,40,41,123,114,101,116,117,114,110,123,46,46,46,115,117,112,101,114,46,115,116,97,116,101,44,109,105,110,105,109,117,109,66,97,108,97,110,99,101,58,116,104,105,115,46,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,44,99,117,114,114,101,110,99,121,58,116,104,105,115,46,35,99,117,114,114,101,110,99,121,44,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,58,116,104,105,115,46,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,44,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,58,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,44,118,97,108,105,100,97,116,111,114,115,58,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,125,125,99,111,110,115,116,114,117,99,116,111,114,40,116,111,107,101,110,65,100,100,114,101,115,115,44,115,116,97,116,101,41,123,115,117,112,101,114,40,115,116,97,116,101,63,46,114,111,108,101,115,41,44,115,116,97,116,101,63,40,116,104,105,115,46,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,61,115,116,97,116,101,46,109,105,110,105,109,117,109,66,97,108,97,110,99,101,44,116,104,105,115,46,35,99,117,114,114,101,110,99,121,61,115,116,97,116,101,46,99,117,114,114,101,110,99,121,44,116,104,105,115,46,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,61,115,116,97,116,101,46,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,44,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,61,115,116,97,116,101,46,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,44,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,61,115,116,97,116,101,46,118,97,108,105,100,97,116,111,114,115,41,58,40,116,104,105,115,46,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,61,53,101,52,44,116,104,105,115,46,35,99,117,114,114,101,110,99,121,61,116,111,107,101,110,65,100,100,114,101,115,115,44,116,104,105,115,46,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,43,61,49,44,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,43,61,49,44,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,109,115,103,46,115,101,110,100,101,114,93,61,123,102,105,114,115,116,83,101,101,110,58,68,97,116,101,46,110,111,119,40,41,44,108,97,115,116,83,101,101,110,58,68,97,116,101,46,110,111,119,40,41,44,97,99,116,105,118,101,58,33,48,125,41,125,103,101,116,32,110,97,109,101,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,110,97,109,101,125,103,101,116,32,99,117,114,114,101,110,99,121,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,99,117,114,114,101,110,99,121,125,103,101,116,32,118,97,108,105,100,97,116,111,114,115,40,41,123,114,101,116,117,114,110,123,46,46,46,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,125,125,103,101,116,32,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,125,103,101,116,32,109,105,110,105,109,117,109,66,97,108,97,110,99,101,40,41,123,114,101,116,117,114,110,32,116,104,105,115,46,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,125,99,104,97,110,103,101,67,117,114,114,101,110,99,121,40,99,117,114,114,101,110,99,121,41,123,105,102,40,33,116,104,105,115,46,104,97,115,82,111,108,101,40,109,115,103,46,115,101,110,100,101,114,44,34,79,87,78,69,82,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,110,111,116,32,97,110,32,111,119,110,101,114,34,41,59,116,104,105,115,46,35,99,117,114,114,101,110,99,121,61,99,117,114,114,101,110,99,121,125,104,97,115,40,118,97,108,105,100,97,116,111,114,41,123,114,101,116,117,114,110,32,66,111,111,108,101,97,110,40,118,111,105,100,32,48,33,61,61,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,118,97,108,105,100,97,116,111,114,93,41,125,35,105,115,65,108,108,111,119,101,100,40,97,100,100,114,101,115,115,41,123,105,102,40,109,115,103,46,115,101,110,100,101,114,33,61,61,97,100,100,114,101,115,115,38,38,33,116,104,105,115,46,104,97,115,82,111,108,101,40,109,115,103,46,115,101,110,100,101,114,44,34,79,87,78,69,82,34,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,115,101,110,100,101,114,32,105,115,32,110,111,116,32,116,104,101,32,118,97,108,105,100,97,116,111,114,32,111,114,32,111,119,110,101,114,34,41,59,114,101,116,117,114,110,33,48,125,97,115,121,110,99,32,97,100,100,86,97,108,105,100,97,116,111,114,40,118,97,108,105,100,97,116,111,114,41,123,105,102,40,116,104,105,115,46,35,105,115,65,108,108,111,119,101,100,40,118,97,108,105,100,97,116,111,114,41,44,116,104,105,115,46,104,97,115,40,118,97,108,105,100,97,116,111,114,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,97,108,114,101,97,100,121,32,97,32,118,97,108,105,100,97,116,111,114,34,41,59,99,111,110,115,116,32,98,97,108,97,110,99,101,61,97,119,97,105,116,32,109,115,103,46,115,116,97,116,105,99,67,97,108,108,40,116,104,105,115,46,99,117,114,114,101,110,99,121,44,34,98,97,108,97,110,99,101,79,102,34,44,91,118,97,108,105,100,97,116,111,114,93,41,59,105,102,40,98,97,108,97,110,99,101,60,116,104,105,115,46,109,105,110,105,109,117,109,66,97,108,97,110,99,101,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,96,98,97,108,97,110,99,101,32,116,111,32,108,111,119,33,32,103,111,116,58,32,36,123,98,97,108,97,110,99,101,125,32,110,101,101,100,58,32,36,123,116,104,105,115,46,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,125,96,41,59,116,104,105,115,46,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,43,61,49,44,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,43,61,49,44,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,118,97,108,105,100,97,116,111,114,93,61,123,102,105,114,115,116,83,101,101,110,58,68,97,116,101,46,110,111,119,40,41,44,108,97,115,116,83,101,101,110,58,68,97,116,101,46,110,111,119,40,41,44,97,99,116,105,118,101,58,33,48,125,125,114,101,109,111,118,101,86,97,108,105,100,97,116,111,114,40,118,97,108,105,100,97,116,111,114,41,123,105,102,40,116,104,105,115,46,35,105,115,65,108,108,111,119,101,100,40,118,97,108,105,100,97,116,111,114,41,44,33,116,104,105,115,46,104,97,115,40,118,97,108,105,100,97,116,111,114,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,118,97,108,105,100,97,116,111,114,32,110,111,116,32,102,111,117,110,100,34,41,59,116,104,105,115,46,35,116,111,116,97,108,86,97,108,105,100,97,116,111,114,115,45,61,49,44,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,118,97,108,105,100,97,116,111,114,93,46,97,99,116,105,118,101,38,38,40,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,45,61,49,41,44,100,101,108,101,116,101,32,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,118,97,108,105,100,97,116,111,114,93,125,97,115,121,110,99,32,117,112,100,97,116,101,86,97,108,105,100,97,116,111,114,40,118,97,108,105,100,97,116,111,114,44,97,99,116,105,118,101,41,123,105,102,40,116,104,105,115,46,35,105,115,65,108,108,111,119,101,100,40,118,97,108,105,100,97,116,111,114,41,44,33,116,104,105,115,46,104,97,115,40,118,97,108,105,100,97,116,111,114,41,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,118,97,108,105,100,97,116,111,114,32,110,111,116,32,102,111,117,110,100,34,41,59,99,111,110,115,116,32,98,97,108,97,110,99,101,61,97,119,97,105,116,32,109,115,103,46,115,116,97,116,105,99,67,97,108,108,40,116,104,105,115,46,99,117,114,114,101,110,99,121,44,34,98,97,108,97,110,99,101,79,102,34,44,91,118,97,108,105,100,97,116,111,114,93,41,59,105,102,40,98,97,108,97,110,99,101,60,116,104,105,115,46,109,105,110,105,109,117,109,66,97,108,97,110,99,101,38,38,97,99,116,105,118,101,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,96,98,97,108,97,110,99,101,32,116,111,32,108,111,119,33,32,103,111,116,58,32,36,123,98,97,108,97,110,99,101,125,32,110,101,101,100,58,32,36,123,116,104,105,115,46,35,109,105,110,105,109,117,109,66,97,108,97,110,99,101,125,96,41,59,105,102,40,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,118,97,108,105,100,97,116,111,114,93,46,97,99,116,105,118,101,61,61,61,97,99,116,105,118,101,41,116,104,114,111,119,32,110,101,119,32,69,114,114,111,114,40,34,97,108,114,101,97,100,121,32,34,43,40,97,99,116,105,118,101,63,34,97,99,116,105,118,97,116,101,100,34,58,34,100,101,97,99,116,105,118,97,116,101,100,34,41,41,59,97,99,116,105,118,101,63,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,43,61,49,58,116,104,105,115,46,35,97,99,116,105,118,101,86,97,108,105,100,97,116,111,114,115,45,61,49,44,116,104,105,115,46,35,118,97,108,105,100,97,116,111,114,115,91,118,97,108,105,100,97,116,111,114,93,46,97,99,116,105,118,101,61,97,99,116,105,118,101,125,125,114,101,116,117,114,110,32,86,97,108,105,100,97,116,111,114,115,59,63,91,34,73,72,78,89,50,71,81,72,51,67,52,52,82,82,85,68,77,52,88,76,71,54,55,75,72,72,83,51,85,69,82,55,76,54,78,85,76,68,72,72,54,65,67,86,79,65,86,84,76,65,71,66,82,76,66,53,66,83,74,34,93";
var bytecodes = {
	contractFactory: contractFactory,
	nativeToken: nativeToken,
	nameService: nameService,
	validators: validators
};

const contractFactoryMessage = bytecodes.contractFactory;
const nativeTokenMessage = bytecodes.nativeToken;
const nameServiceMessage = bytecodes.nameService;
const validatorsMessage = bytecodes.validators;
const createContractMessage = async (creator, contract, constructorParameters = []) => {
    return new ContractMessage({
        creator,
        contract,
        constructorParameters
    });
};
const calculateFee = async (transaction, format = false) => {
    // excluded from fees
    if (transaction.to === validators$1)
        return 0;
    transaction = await new TransactionMessage(transaction);
    let fee = parseUnits(String(transaction.encoded.length));
    // fee per gb
    fee = fee.div(1073741824);
    // fee = fee.div(1000000)
    return format ? formatUnits(fee.toString()) : fee;
};
const calculateTransactionFee = transaction => {
    transaction = new TransactionMessage(transaction);
    return calculateFee(transaction);
};
const calculateReward = (validators, fees) => {
    validators = Object.keys(validators).reduce((set, key) => {
        if (validators[key].active)
            set.push({
                address: key,
                reward: 0
            });
        return set;
    }, []);
    return validators;
};
const createTransactionHash = async (transaction) => {
    const isRawTransactionMessage = transaction instanceof RawTransactionMessage;
    let message;
    if (!isRawTransactionMessage)
        message = await new RawTransactionMessage(transaction instanceof TransactionMessage ? transaction.decoded : transaction);
    else
        message = transaction;
    return (await message.peernetHash).digest;
};
const signTransaction = async (transaction, wallet) => {
    const signature = toBase58(await wallet.sign(await createTransactionHash(transaction)));
    return { ...transaction, signature };
};
const prepareContractTransaction = async (owner, contract, constructorParameters = []) => {
    const message = await createContractMessage(owner, contract, constructorParameters);
    const hash = await message.hash();
    const transaction = {
        from: owner,
        to: contractFactory$1,
        timestamp: new Date().getTime(),
        method: 'registerContract',
        params: [hash]
    };
    return transaction;
};
/**
 *
 * @param owner address
 * @param contract contract code
 * @param constructorParameters ...
 * @param wallet {sign}
 * @returns
 */
const prepareContractTransactionAndSign = async (owner, contract, constructorParameters = [], wallet) => {
    const transaction = await prepareContractTransaction(owner, contract, constructorParameters);
    return signTransaction(transaction, wallet);
};

export { calculateFee, calculateReward, calculateTransactionFee, contractFactoryMessage, createContractMessage, createTransactionHash, nameServiceMessage, nativeTokenMessage, prepareContractTransaction, prepareContractTransactionAndSign, signTransaction, validatorsMessage };
