import {calculateFee, createTransactionHash} from './exports/index.js'
import { formatUnits } from '@leofcoin/utils'

const transaction = {
  from: "YTqzkFatW1LmGXhfHicj3xTirQxYqKezfFter31Pq1RNRa6UWYYWs",
  method:"transfer",
  nonce: 313348,
  params: ['YTqzkFatW1LmGXhfHicj3xTirQxYqKezfFter31Pq1RNRa6UWYYWs', 'YTqwTAojA8aZDPYhSFey3KsYb66YdEa4Xe7L6E484VTfMSVvauLZd', '100000000000000000000'],
  signature: new Uint8Array([0, 196, 7, 133, 115, 24, 136, 210, 114, 80, 122, 34, 154, 44, 76, 216, 18, 142, 75, 102, 12, 237, 85, 184, 115, 196, 222, 220, 132, 156, 201, 79, 190, 122, 123, 114, 112, 95, 84, 36, 225, 11, 175, 0, 236, 100, 5, 20, 128, 23, 249, 153, 206, 2, 103, 178, 14, 93, 66, 115, 8, 63, 110, 128, 180, 219, 42]),
  timestamp: 1678450782309,
  to: "IHNY2GQHXGQL4URICKLN5SE5ULIPF2QSFWU3DP4GZFOA5DBX4MMVDKJ2I3M"
}

const fee = await calculateFee(transaction)

console.log(await createTransactionHash(transaction));
  console.log(fee);

  console.log(formatUnits(fee));