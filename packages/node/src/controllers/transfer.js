import { parseUnits, formatUnits } from '@leofcoin/utils'
import { calculateFee, signTransaction } from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import { getSelectedNetwork } from '../network-selection.js'

export const errorMessage = (error) => error?.error?.message || error?.error || error?.message || String(error)

export async function validateRecipientAddress(address) {
  address = String(address || '').trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(address)) throw new Error('Enter a valid Leofcoin address.')
  try {
    const network = getSelectedNetwork().network
    await new MultiWallet(network).fromAddress(address, null, network)
  } catch {
    throw new Error('Recipient address has an invalid checksum or public key.')
  }
  return address
}

export function networkStatus(chain, peernet) {
  const peers = Object.values(peernet?.connections || {}).filter((peer) => peer.connected).length
  const synced = chain?.state?.sync === 'synced'
  return {
    peers,
    synced,
    ready: Boolean(chain && synced && peers > 0),
    label: !chain
      ? 'Unlock your wallet to start the node.'
      : !peers
      ? 'No connected peers. Waiting for the network…'
      : !synced
      ? 'Syncing the chain. Sending is available after sync.'
      : 'Connected and synced'
  }
}

export async function prepareTransfer({ chain, peernet, identity, from, to, amount }) {
  if (!networkStatus(chain, peernet).ready)
    throw new Error('Wait until your node is connected and synced before sending.')
  to = await validateRecipientAddress(to)
  const value = String(amount || '').trim()
  if (!/^\d+(\.\d{1,18})?$/.test(value)) throw new Error('Enter a positive amount with at most 18 decimal places.')
  const units = parseUnits(value)
  if (units <= 0n) throw new Error('Amount must be greater than zero.')
  const signer = await identity.signer(from)
  const raw = await chain.createTransaction({
    from,
    to: chain.nativeToken,
    method: 'transfer',
    params: [to, units.toString()]
  })
  const signed = await signTransaction(raw, signer)
  const fee = BigInt(await calculateFee(signed))
  const balance = BigInt((await chain.balanceOf(from)) ?? 0n)
  if (balance < units + fee)
    throw new Error(`Insufficient balance. You need ${formatUnits(units + fee)} LFC including the fee.`)
  return { from, to, amount: formatUnits(units), fee: formatUnits(fee), total: formatUnits(units + fee), signed }
}

export async function submitTransfer(chain, prepared, onState) {
  onState({ phase: 'submitting' })
  const pending = await chain.sendTransaction(prepared.signed)
  if (!pending?.hash || !pending.wait || typeof pending.wait.then !== 'function') {
    throw new Error('The node did not return a transaction confirmation handle.')
  }
  onState({ phase: 'pending', hash: pending.hash })
  await pending.wait
  onState({ phase: 'confirmed', hash: pending.hash })
  return pending.hash
}
