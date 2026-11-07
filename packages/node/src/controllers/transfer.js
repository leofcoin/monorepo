import { parseUnits, formatUnits } from '@leofcoin/utils'
import { calculateFee, signTransaction } from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import { getSelectedNetwork } from '../network-selection.js'
import { BinaryWriter, varUintLength } from '@leofcoin/binary'
import base58 from '@vandeurenglenn/base58'

export const errorMessage = (error) => error?.error?.message || error?.error || error?.message || String(error)

export async function validateRecipientAddress(address, network = getSelectedNetwork().network) {
  address = String(address || '').trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(address)) throw new Error('Enter a valid Leofcoin address.')
  try {
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

async function transferInput({ chain, peernet, from, to, amount }) {
  if (!networkStatus(chain, peernet).ready)
    throw new Error('Wait until your node is connected and synced before sending.')
  to = await validateRecipientAddress(to)
  const value = String(amount || '').trim()
  if (!/^\d+(\.\d{1,18})?$/.test(value)) throw new Error('Enter a positive amount with at most 18 decimal places.')
  const units = parseUnits(value)
  if (units <= 0n) throw new Error('Amount must be greater than zero.')
  const raw = await chain.createTransaction({
    from,
    to: chain.nativeToken,
    method: 'transfer',
    params: [to, units.toString()]
  })
  return { from, to, units, raw }
}

// Schnorr signatures have a fixed 64-byte body. Derive the framing from the
// public account, not a private signer. An all-FF body bounds the base58 length;
// exact fees are recalculated from the real signature at confirmation.
export async function previewTransfer(options) {
  const { from, to, units, raw } = await transferInput(options)
  const network = getSelectedNetwork().network
  const publicWallet = new MultiWallet(network)
  await publicWallet.fromAddress(from, null, network)
  const version = publicWallet.version, codec = publicWallet.network.multiCodec
  const writer = new BinaryWriter(varUintLength(version) + varUintLength(codec) + 64)
  const signature = base58.encode(writer.writeVarUint(version).writeVarUint(codec).writeBytes(new Uint8Array(64).fill(255)).finish())
  const fee = BigInt(await calculateFee({ ...raw, signature }))
  const value = await options.chain.balanceOf(from)
  if (value === undefined || value === null) throw new Error('Your balance is not available yet. Wait for sync and try again.')
  const balance = BigInt(value)
  return { from, to, amount: formatUnits(units), fee: formatUnits(fee), total: formatUnits(units + fee),
    balance: formatUnits(balance), balanceAfter: formatUnits(balance - units - fee), affordable: balance >= units + fee }
}

export async function prepareTransfer(options) {
  const { chain, identity } = options
  const { from, to, units, raw } = await transferInput(options)
  const balanceValue = await chain.balanceOf(from)
  if (balanceValue === undefined || balanceValue === null) throw new Error('Your balance is not available yet.')
  const balance = BigInt(balanceValue)
  if (balance < units) throw new Error('Insufficient balance for this transfer.')
  const signer = await identity.signer(from)
  const signed = await signTransaction(raw, signer)
  const fee = BigInt(await calculateFee(signed))
  if (balance < units + fee)
    throw new Error(`Insufficient balance. You need ${formatUnits(units + fee)} LFC including the fee.`)
  return { from, to, amount: formatUnits(units), fee: formatUnits(fee), total: formatUnits(units + fee), signed }
}

export function createTransferPreview(onChange) {
  let generation = 0
  return {
    cancel() { generation++ },
    async update(options) {
      const current = ++generation
      onChange({ state: 'loading' })
      try {
        const quote = await previewTransfer(options)
        if (current === generation) onChange({ state: 'ready', quote })
      } catch (error) {
        if (current === generation) onChange({ state: 'error', error: errorMessage(error) })
      }
    }
  }
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
