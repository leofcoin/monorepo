import { Transaction } from '@leofcoin/types';

export default {
  timestamp: Number(),
  from: String(),
  to: String(),
  nonce: Number(),
  method: String(),
  params: Array(),
  signature: String()
} as Transaction
