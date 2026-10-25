import MultiWallet from '@leofcoin/multi-wallet'
import { ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { calculateFee, signTransaction, MAX_TRANSACTION_BYTES } from '@leofcoin/lib'
import { verifyChainIdentity, type ChainIdentity } from '@leofcoin/lib/chain-identity'
import { parseUnits, formatUnits, jsonParseBigInt } from '@leofcoin/utils'
import { FAUCET_SOURCE } from './templates.js'

export type ChainProfile = { id: string; name: string; endpoint: string; chainId: string; network: string; testnet: boolean }
export type NodeStatus = {
  chainId: string; network: string; height: string; peers: number; synced: boolean
  nativeToken: string; contractFactory: string; balance: string; nonce: number
}
export type Review = {
  id: string; kind: 'call' | 'deploy' | 'fund' | 'mint'; chainId: string; endpoint: string
  from: string; to: string; method: string; params: unknown[]; fee: string; amount?: string
  contractAddress?: string; createdAt: number; workflowId?: string; workflowStep?: string
}
export type Activity = {
  id: string; profileId: string; chainId: string; hash: string; kind: string
  status: 'submitting' | 'pending' | 'confirmed' | 'failed' | 'unknown'
  createdAt: number; error?: string; contractAddress?: string; workflowId?: string; workflowStep?: string
}
export type FaucetSetup = {
  id: string; profileId: string; chainId: string; owner: string; token: string; address: string
  claim: string; cooldownMs: number; budget: string; funding: string
}
type Backup = { schema: 'leofcoin:operator-wallet:v1'; network: string; address: string; encrypted: string }
type RawTransaction = { from: string; to: string; method: string; params: unknown[]; nonce: number; timestamp: number }
type SignedTransaction = RawTransaction & { signature: string }
type Prepared = {
  review: Review; transaction: SignedTransaction; contract?: string
  cost: bigint; nonce: number; profileId: string
}
const PROFILES = 'leofcoin:manager:profiles:v1'
const WALLET = 'leofcoin:manager:wallet:v1'
const ACTIVITY = 'leofcoin:manager:activity:v1'
const FAUCETS = 'leofcoin:manager:faucets:v1'
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const hashPattern = /^[A-Z2-7]{32,128}$/
const idPattern = /^lfc:[0-9a-f]{64}$/
const operatorAccount = (wallet: MultiWallet) =>
  wallet.derivePath(`m/44'/${wallet.network.coin_type}'/1'/0/1`)
const amountUnits = (amount: string, decimals = 18) => {
  if (!new RegExp(`^(0|[1-9]\\d{0,59})${decimals ? `(\\.\\d{1,${decimals}})?` : ''}$`).test(amount))
    throw new Error(`Enter a decimal amount with at most ${decimals} decimals`)
  const [whole, fraction = ''] = amount.split('.')
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')
  if (units <= 0n) throw new Error('Amount must be positive')
  return units
}
export function endpointURL(raw: string): string {
  const url = new URL(raw.trim())
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Use an HTTP(S) endpoint without credentials, query or fragment')
  return url.href.replace(/\/$/, '')
}
export function parameters(raw: string): unknown[] {
  if (new TextEncoder().encode(raw).length > 262144) throw new Error('Parameters exceed 256 KiB')
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.length > 100) throw new Error('Parameters must be a JSON array of at most 100 entries')
  return value
}
function backupFrom(raw: string): Backup {
  if (raw.length > 1_048_576) throw new Error('Wallet backup exceeds 1 MiB')
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || value.schema !== 'leofcoin:operator-wallet:v1' ||
      typeof value.network !== 'string' || typeof value.address !== 'string' ||
      typeof value.encrypted !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(value.encrypted) ||
      Object.keys(value).some(key => !['schema', 'network', 'address', 'encrypted'].includes(key)))
    throw new Error('Use an encrypted Chain Manager operator-wallet backup')
  return { schema: 'leofcoin:operator-wallet:v1', network: value.network, address: value.address, encrypted: value.encrypted }
}

export class OperatorController extends EventTarget {
  profiles: ChainProfile[] = []
  activeId = ''
  status?: NodeStatus
  walletAddress = ''
  walletUnlocked = false
  walletExists = false
  busy = false
  error = ''
  notice = ''
  prepared?: Review
  activity: Activity[] = []
  faucetSetups: FaucetSetup[] = []
  faucetStep: 'approval' | 'deploy' | 'fund' | 'waiting' | 'complete' | undefined
  #storage: Storage
  #wallet?: MultiWallet
  #backup?: Backup
  #prepared?: Prepared
  #idleTimer?: ReturnType<typeof setTimeout>

  constructor(storage: Storage = localStorage) {
    super()
    this.#storage = storage
    try {
      const profiles: unknown = JSON.parse(storage.getItem(PROFILES) || '[]')
      if (!Array.isArray(profiles) || profiles.length > 50 || profiles.some(profile =>
        !isRecord(profile) || typeof profile.id !== 'string' || typeof profile.name !== 'string' ||
        typeof profile.endpoint !== 'string' || endpointURL(profile.endpoint) !== profile.endpoint ||
        typeof profile.chainId !== 'string' || !idPattern.test(profile.chainId) ||
        typeof profile.network !== 'string' || typeof profile.testnet !== 'boolean'))
        throw new Error('Stored chain profiles are invalid')
      this.profiles = profiles
      const backup = storage.getItem(WALLET)
      if (backup) {
        this.#backup = backupFrom(backup)
        this.walletAddress = this.#backup.address
        this.walletExists = true
      }
      const activity: unknown = JSON.parse(storage.getItem(ACTIVITY) || '[]')
      if (!Array.isArray(activity) || activity.length > 200 || activity.some(entry =>
        !isRecord(entry) || typeof entry.id !== 'string' || typeof entry.profileId !== 'string' ||
        typeof entry.chainId !== 'string' || !idPattern.test(entry.chainId) ||
        typeof entry.hash !== 'string' || !hashPattern.test(entry.hash) || typeof entry.kind !== 'string' ||
        !Number.isSafeInteger(entry.createdAt) || typeof entry.status !== 'string' ||
        (entry.workflowId !== undefined && typeof entry.workflowId !== 'string') ||
        (entry.workflowStep !== undefined && !['approval', 'deploy', 'fund'].includes(String(entry.workflowStep))) ||
        !['submitting', 'pending', 'confirmed', 'failed', 'unknown'].includes(entry.status)))
        throw new Error('Stored transaction activity is invalid')
      this.activity = activity
      const setups: unknown = JSON.parse(storage.getItem(FAUCETS) || '[]')
      if (!Array.isArray(setups) || setups.length > 50 || setups.some(setup =>
        !isRecord(setup) || typeof setup.id !== 'string' || typeof setup.profileId !== 'string' ||
        typeof setup.chainId !== 'string' || !idPattern.test(setup.chainId) ||
        typeof setup.owner !== 'string' || typeof setup.token !== 'string' || !hashPattern.test(setup.token) ||
        typeof setup.address !== 'string' || !hashPattern.test(setup.address) ||
        typeof setup.claim !== 'string' || typeof setup.budget !== 'string' || typeof setup.funding !== 'string' ||
        !/^\d+(\.\d{1,18})?$/.test(setup.claim) || !/^\d+(\.\d{1,18})?$/.test(setup.budget) || !/^\d+(\.\d{1,18})?$/.test(setup.funding) ||
        amountUnits(setup.budget) < amountUnits(setup.claim) || amountUnits(setup.funding) < amountUnits(setup.claim) ||
        amountUnits(setup.funding) > amountUnits(setup.budget) ||
        !Number.isSafeInteger(setup.cooldownMs) || Number(setup.cooldownMs) < 60000))
        throw new Error('Stored faucet setups are invalid')
      this.faucetSetups = setups
      this.activeId = this.profiles[0]?.id || ''
    } catch (error) { this.error = `Could not load manager data: ${message(error)}. Stored data was not overwritten.` }
  }
  get active() { return this.profiles.find(profile => profile.id === this.activeId) }
  get faucetSetup() { return this.faucetSetups.find(setup => setup.profileId === this.activeId && setup.owner === this.walletAddress) }
  #change() { this.dispatchEvent(new Event('change')) }
  async #run<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('Another manager operation is in progress')
    this.busy = true
    this.error = ''
    this.notice = ''
    this.#change()
    try { return await action() }
    catch (error) { this.error = message(error); throw error }
    finally { this.busy = false; this.#change() }
  }
  #profile() {
    const profile = this.active
    if (!profile) throw new Error('Add and select a verified chain first')
    return profile
  }
  async #request(profile: ChainProfile, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${profile.endpoint}/manager/rpc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, chainId: profile.chainId }),
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Management API HTTP ${response.status}: ${text.slice(0, 300)}. Update the node's @leofcoin/endpoints package if this API is unavailable.`)
    }
    return JSON.parse(await response.text(), jsonParseBigInt)
  }
  async #identity(endpoint: string): Promise<ChainIdentity> {
    const response = await fetch(`${endpoint}/chainIdentity`, {
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000)
    })
    if (!response.ok) throw new Error(`Identity request failed: HTTP ${response.status}`)
    return verifyChainIdentity(await response.json())
  }
  async discoverProfile(name: string, rawEndpoint: string, testnet: boolean) {
    return this.#run(async () => {
      name = name.trim()
      if (!name || name.length > 80) throw new Error('Chain name must be 1–80 characters')
      if (this.profiles.length >= 50) throw new Error('At most 50 chain profiles are supported')
      const endpoint = endpointURL(rawEndpoint)
      if (this.profiles.some(profile => profile.endpoint === endpoint)) throw new Error('This endpoint already has a profile')
      const identity = await this.#identity(endpoint)
      // An operator label cannot turn a mainnet node into a testnet.
      if (testnet && identity.network !== 'leofcoin:peach') throw new Error('Faucet tools are restricted to the supported Peach testnet namespace')
      const profile: ChainProfile = {
        id: crypto.randomUUID(), name, endpoint, chainId: identity.chainId, network: identity.network, testnet
      }
      const profiles = [...this.profiles, profile]
      this.#storage.setItem(PROFILES, JSON.stringify(profiles))
      this.profiles = profiles
      this.#select(profile.id)
      this.notice = 'Chain identity verified and pinned. Connecting never imports a remote wallet.'
    })
  }
  #select(id: string) {
    this.lockWallet()
    this.activeId = id
    this.status = undefined
    this.faucetStep = undefined
    this.#change()
  }
  selectProfile(id: string) {
    if (this.busy) throw new Error('Wait for the current operation before switching chains')
    if (!this.profiles.some(profile => profile.id === id)) throw new Error('Unknown chain profile')
    this.#select(id)
  }
  removeProfile(id: string) {
    if (this.busy) throw new Error('Wait for the current operation before removing a profile')
    if (this.activity.some(entry => entry.profileId === id && ['submitting', 'pending', 'unknown'].includes(entry.status)))
      throw new Error('Reconcile outstanding transactions before removing this chain profile')
    const profiles = this.profiles.filter(profile => profile.id !== id)
    this.#storage.setItem(PROFILES, JSON.stringify(profiles))
    this.profiles = profiles
    if (this.activeId === id) this.#select(profiles[0]?.id || '')
    this.#change()
  }
  async #status(profile: ChainProfile): Promise<NodeStatus> {
    const identity = await this.#identity(profile.endpoint)
    if (identity.chainId !== profile.chainId) throw new Error('CHAIN MISMATCH: this endpoint no longer serves the pinned chain')
    const raw = await this.#request(profile, { action: 'status', account: this.walletAddress || undefined })
    if (!isRecord(raw) || raw.apiVersion !== 1 || raw.chainId !== profile.chainId || raw.network !== profile.network ||
        raw.nativeToken !== identity.genesisContracts.nativeToken || raw.contractFactory !== identity.genesisContracts.contractFactory ||
        typeof raw.synced !== 'boolean' || typeof raw.peers !== 'number' || !Number.isSafeInteger(raw.peers) || raw.peers < 0 ||
        typeof raw.nonce !== 'number' || !Number.isSafeInteger(raw.nonce) || raw.nonce < 0 ||
        typeof raw.balance !== 'string' || !/^\d+$/.test(raw.balance) ||
        typeof raw.height !== 'string' || !/^\d+$/.test(raw.height))
      throw new Error('Invalid management status response')
    return {
      chainId: profile.chainId, network: profile.network, nativeToken: String(raw.nativeToken),
      contractFactory: String(raw.contractFactory), synced: raw.synced, peers: raw.peers,
      nonce: raw.nonce, height: raw.height, balance: formatUnits(raw.balance)
    }
  }
  async refresh() {
    return this.#run(async () => {
      this.status = undefined
      this.status = await this.#status(this.#profile())
    })
  }
  #network() { return this.active?.network || this.#backup?.network || 'leofcoin:peach' }
  #touch() {
    clearTimeout(this.#idleTimer)
    this.#idleTimer = setTimeout(() => {
      this.lockWallet()
      this.notice = 'Operator wallet automatically locked after five minutes.'
      this.#change()
    }, 300000)
    this.#idleTimer.unref?.()
  }
  async #install(wallet: MultiWallet, backup: Backup) {
    const account = await operatorAccount(wallet)
    if (await account.address !== backup.address) throw new Error('Wallet address does not match the encrypted backup')
    this.#storage.setItem(WALLET, JSON.stringify(backup))
    this.#backup = backup
    this.#wallet = wallet
    this.walletAddress = backup.address
    this.walletExists = true
    this.walletUnlocked = true
    this.#touch()
  }
  async createWallet(password: string) {
    return this.#run(async () => {
      if (this.walletExists) throw new Error('An operator wallet already exists. Export its backup before replacing it in another manager instance.')
      if (password.length < 12) throw new Error('Use a password of at least 12 characters')
      const network = this.#network()
      const wallet = new MultiWallet(network)
      await wallet.generate(undefined, network)
      const backup: Backup = {
        schema: 'leofcoin:operator-wallet:v1', network,
        address: await (await operatorAccount(wallet)).address,
        encrypted: await wallet.export(password)
      }
      await this.#install(wallet, backup)
      return JSON.stringify(backup, null, 2)
    })
  }
  async importWallet(password: string, raw: string) {
    return this.#run(async () => {
      if (this.walletExists) throw new Error('An operator wallet already exists; use its encrypted backup in another isolated manager instance instead of overwriting it')
      const backup = backupFrom(raw)
      const wallet = new MultiWallet(backup.network)
      await wallet.import(password, backup.encrypted)
      await this.#install(wallet, backup)
    })
  }
  async unlockWallet(password: string) {
    this.lockWallet()
    return this.#run(async () => {
      if (!this.#backup) throw new Error('Create or import an operator wallet first')
      const wallet = new MultiWallet(this.#backup.network)
      try { await wallet.import(password, this.#backup.encrypted) }
      catch (error) { throw new Error('Unable to unlock the operator wallet. Check your password.', { cause: error }) }
      await this.#install(wallet, this.#backup)
    })
  }
  lockWallet() {
    clearTimeout(this.#idleTimer)
    this.#wallet = undefined
    this.walletUnlocked = false
    this.cancelPrepared()
  }
  exportWallet() {
    if (!this.#backup) throw new Error('No operator wallet to export')
    return JSON.stringify(this.#backup, null, 2)
  }
  #ready(status: NodeStatus) {
    if (!status.synced || status.peers < 1) throw new Error('The selected node must be synced and connected')
  }
  async #read(profile: ChainProfile, contract: string, method: string, params: unknown[]) {
    if (!hashPattern.test(contract) || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(method))
      throw new Error('Use a valid contract hash and public method name')
    const response = await this.#request(profile, { action: 'read', contract, method, params })
    if (!isRecord(response) || !('value' in response)) throw new Error('Invalid contract read response')
    return response.value
  }
  async staticCall(contract: string, method: string, json: string) {
    return this.#run(async () => {
      const profile = this.#profile()
      await this.#status(profile)
      return this.#read(profile, contract.trim(), method.trim(), parameters(json))
    })
  }
  async #prepare(kind: Review['kind'], target: string, method: string, params: unknown[], source?: string, amount?: string, cost = 0n) {
    this.cancelPrepared()
    const profile = this.#profile()
    const wallet = this.#wallet
    if (!wallet || !this.walletUnlocked) throw new Error('Unlock your operator wallet before preparing a transaction')
    const status = await this.#status(profile)
    this.#ready(status)
    this.status = status
    if (this.activity.some(entry => entry.profileId === profile.id && ['submitting', 'pending', 'unknown'].includes(entry.status)))
      throw new Error('Reconcile the outstanding transaction on this chain before preparing another')
    let contract: string | undefined
    let contractAddress: string | undefined
    if (source !== undefined) {
      if (!source.trim() || new TextEncoder().encode(source).length > 131072) throw new Error('Contract source must be 1–128 KiB of self-contained JavaScript')
      const message = new ContractMessage({ creator: this.walletAddress, contract: source, constructorParameters: params })
      contract = await message.toString()
      contractAddress = await message.hash()
      target = status.contractFactory
      method = 'registerContract'
      params = [contractAddress]
      const payment = await this.#read(profile, target, 'tokenAmountToReceive', [])
      if (!/^\d+$/.test(String(payment))) throw new Error('Invalid factory registration price')
      const registration = BigInt(String(payment))
      const token = await this.#read(profile, target, 'tokenToReceive', [])
      if (token !== status.nativeToken) throw new Error('Factory requires an unsupported registration token')
      const approved = await this.#read(profile, status.nativeToken, 'allowance', [this.walletAddress, target])
      if (!/^\d+$/.test(String(approved)) || BigInt(String(approved)) < registration)
        throw new Error(`Factory needs an allowance of ${formatUnits(registration)} LFC. Review and send approve(factory, amountInUnits) on the native token first.`)
      cost += registration
    }
    if (!hashPattern.test(target) || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(method))
      throw new Error('Use a valid contract hash and public method name')
    if (target === status.nativeToken && ['mint', 'burn', 'grantRole', 'revokeRole'].includes(method))
      throw new Error('Native LFC monetary permissions are protocol-controlled; the manager cannot change or use them')
    const raw: RawTransaction = {
      from: this.walletAddress, to: target, method, params, nonce: status.nonce + 1, timestamp: Date.now()
    }
    const signer = await operatorAccount(wallet)
    const signature = (await signTransaction(raw, { sign: hash => signer.sign(hash.subarray(0, 32)) })).signature
    const transaction: SignedTransaction = { ...raw, signature }
    if (new TransactionMessage(transaction).encoded.length > MAX_TRANSACTION_BYTES) throw new Error('Transaction exceeds protocol size limit')
    const fee = BigInt(await calculateFee(transaction))
    if (parseUnits(status.balance) < cost + fee) throw new Error(`Insufficient LFC balance for ${formatUnits(cost + fee)} LFC including fees and registration cost`)
    if (this.#wallet !== wallet) throw new Error('Wallet locked while preparing. Unlock and review again.')
    const review: Review = {
      id: crypto.randomUUID(), kind, chainId: profile.chainId, endpoint: profile.endpoint,
      from: raw.from, to: target, method, params: structuredClone(params), fee: formatUnits(fee),
      amount: amount || (cost > 0n ? formatUnits(cost) : undefined), contractAddress, createdAt: Date.now()
    }
    this.#prepared = { review: structuredClone(review), transaction, contract, cost: cost + fee, nonce: raw.nonce, profileId: profile.id }
    this.prepared = review
    this.#touch()
  }
  async prepareCall(contract: string, method: string, json: string) {
    return this.#run(async () => {
      const params = parameters(json)
      let cost = 0n
      const status = await this.#status(this.#profile())
      if (contract.trim() === status.nativeToken && method.trim() === 'transfer') {
        if (params.length !== 2 || !/^\d+$/.test(String(params[1])) || BigInt(String(params[1])) <= 0n)
          throw new Error('Native transfer requires recipient and positive integer units')
        cost = BigInt(String(params[1]))
      }
      await this.#prepare('call', contract.trim(), method.trim(), params, undefined, undefined, cost)
    })
  }
  async prepareDeploy(source: string, json: string) {
    return this.#run(() => this.#prepare('deploy', '', '', parameters(json), source))
  }
  #testnet() {
    const profile = this.#profile()
    if (!profile.testnet || profile.network !== 'leofcoin:peach') throw new Error('Faucet operations require an explicitly marked Peach testnet profile')
    return profile
  }
  async #recipient(recipient: string, allowContract = true) {
    if (allowContract && hashPattern.test(recipient)) return recipient
    if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(recipient)) throw new Error('Enter a public account address or contract hash')
    await new MultiWallet(this.#network()).fromAddress(recipient, null, this.#network())
    return recipient
  }
  async prepareFunding(recipient: string, amount: string) {
    return this.#run(async () => {
      const profile = this.#testnet()
      const status = await this.#status(profile)
      const units = amountUnits(amount.trim())
      await this.#prepare('fund', status.nativeToken, 'transfer',
        [await this.#recipient(recipient.trim()), units.toString()], undefined, formatUnits(units), units)
    })
  }
  async prepareMint(token: string, recipient: string, amount: string) {
    return this.#run(async () => {
      const profile = this.#testnet()
      const status = await this.#status(profile)
      token = token.trim()
      if (token === status.nativeToken) throw new Error('Native LFC cannot be manually minted')
      const decimals = Number(await this.#read(profile, token, 'decimals', []))
      if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported custom-token decimals')
      if (await this.#read(profile, token, 'hasRole', [this.walletAddress, 'MINT']) !== true)
        throw new Error('Operator does not hold the MINT role for this custom token')
      const units = amountUnits(amount.trim(), decimals)
      await this.#prepare('mint', token, 'mint', [await this.#recipient(recipient.trim()), units.toString()], undefined, `${amount} custom tokens`)
    })
  }
  async configureFaucet(claim: string, cooldownMs: number, budget: string, funding: string) {
    return this.#run(async () => {
      const profile = this.#testnet()
      if (!this.walletUnlocked) throw new Error('Unlock the operator wallet before setting up a faucet')
      if (this.faucetSetup) throw new Error('A saved setup already exists for this wallet and chain')
      const status = await this.#status(profile)
      const claimUnits = amountUnits(claim.trim())
      const budgetUnits = amountUnits(budget.trim())
      const fundingUnits = amountUnits(funding.trim())
      if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 60000) throw new Error('Cooldown must be at least 60000 milliseconds')
      if (budgetUnits < claimUnits || fundingUnits < claimUnits || fundingUnits > budgetUnits)
        throw new Error('Budget must cover one claim; initial funding must be between one claim and the lifetime budget')
      const message = new ContractMessage({
        creator: this.walletAddress, contract: FAUCET_SOURCE,
        constructorParameters: [status.nativeToken, claimUnits.toString(), cooldownMs, budgetUnits.toString()]
      })
      const setup: FaucetSetup = {
        id: crypto.randomUUID(), profileId: profile.id, chainId: profile.chainId, owner: this.walletAddress,
        token: status.nativeToken, address: await message.hash(), claim: formatUnits(claimUnits),
        cooldownMs, budget: formatUnits(budgetUnits), funding: formatUnits(fundingUnits)
      }
      if (this.faucetSetups.length >= 50) throw new Error('At most 50 saved faucet setups are supported')
      const setups = [...this.faucetSetups, setup]
      this.#storage.setItem(FAUCETS, JSON.stringify(setups))
      this.faucetSetups = setups
      this.faucetStep = undefined
      this.notice = 'Faucet setup saved. Check the next step; nothing has been broadcast.'
    })
  }
  faucetConstructor(setup: FaucetSetup): string {
    return JSON.stringify([setup.token, amountUnits(setup.claim).toString(), setup.cooldownMs, amountUnits(setup.budget).toString()])
  }
  async #faucetNext() {
    const profile = this.#testnet()
    const setup = this.faucetSetup
    if (!setup || setup.chainId !== profile.chainId) throw new Error('Save a faucet setup for this wallet and chain first')
    const status = await this.#status(profile)
    this.status = status
    const message = new ContractMessage({
      creator: setup.owner, contract: FAUCET_SOURCE, constructorParameters: parameters(this.faucetConstructor(setup))
    })
    if (setup.token !== status.nativeToken || await message.hash() !== setup.address)
      throw new Error('Saved faucet configuration does not match this chain and template')
    const entries = this.activity.filter(entry => entry.workflowId === setup.id && entry.profileId === profile.id)
    if (entries.some(entry => ['pending', 'submitting', 'unknown'].includes(entry.status))) return 'waiting' as const
    const deployed = entries.some(entry => entry.workflowStep === 'deploy' && entry.status === 'confirmed' && entry.contractAddress === setup.address)
    if (!deployed) {
      const registrationToken = await this.#read(profile, status.contractFactory, 'tokenToReceive', [])
      if (registrationToken !== setup.token) throw new Error('Factory requires an unsupported registration token')
      const amount = await this.#read(profile, status.contractFactory, 'tokenAmountToReceive', [])
      const allowance = await this.#read(profile, setup.token, 'allowance', [setup.owner, status.contractFactory])
      if (!/^\d+$/.test(String(amount)) || !/^\d+$/.test(String(allowance))) throw new Error('Invalid factory price or allowance')
      return BigInt(String(allowance)) < BigInt(String(amount)) ? 'approval' as const : 'deploy' as const
    }
    const state = await this.#read(profile, setup.address, 'state', [])
    if (!isRecord(state) || state.owner !== setup.owner || state.token !== setup.token ||
        String(state.amount) !== amountUnits(setup.claim).toString() || Number(state.cooldown) !== setup.cooldownMs ||
        String(state.budget) !== amountUnits(setup.budget).toString() || !/^\d+$/.test(String(state.spent)))
      throw new Error('Deployed faucet does not match the reviewed configuration')
    if (!entries.some(entry => entry.workflowStep === 'fund' && entry.status === 'confirmed')) return 'fund' as const
    const balance = await this.#read(profile, setup.token, 'balanceOf', [setup.address])
    if (!/^\d+$/.test(String(balance))) throw new Error('Invalid faucet token balance')
    if (BigInt(String(balance)) < amountUnits(setup.claim) || BigInt(String(state.budget)) - BigInt(String(state.spent)) < amountUnits(setup.claim))
      throw new Error('Faucet cannot cover another claim: check its balance and remaining lifetime budget')
    return 'complete' as const
  }
  async checkFaucetSetup() {
    return this.#run(async () => {
      this.faucetStep = undefined
      this.faucetStep = await this.#faucetNext()
      this.notice = this.faucetStep === 'complete'
        ? 'Faucet configuration and claim capacity verified on-chain. Users can call claim(); no test claim was broadcast.'
        : 'Faucet step checked. Every transaction still requires separate review and consent.'
    })
  }
  async prepareFaucetStep() {
    return this.#run(async () => {
      this.faucetStep = undefined
      const step = await this.#faucetNext()
      this.faucetStep = step
      const setup = this.faucetSetup
      const status = this.status
      if (!setup || !status) throw new Error('Faucet context is unavailable')
      if (step === 'approval') {
        const price = await this.#read(this.#profile(), status.contractFactory, 'tokenAmountToReceive', [])
        if (!/^\d+$/.test(String(price))) throw new Error('Invalid factory registration price')
        await this.#prepare('call', setup.token, 'approve', [status.contractFactory, String(price)], undefined, formatUnits(BigInt(String(price))))
      } else if (step === 'deploy') {
        await this.#prepare('deploy', '', '', parameters(this.faucetConstructor(setup)), FAUCET_SOURCE)
        if (this.prepared?.contractAddress !== setup.address) { this.cancelPrepared(); throw new Error('Faucet address differs from saved setup') }
      } else if (step === 'fund') {
        const units = amountUnits(setup.funding)
        await this.#prepare('fund', setup.token, 'transfer', [setup.address, units.toString()], undefined, setup.funding, units)
      } else throw new Error(step === 'waiting' ? 'Wait for canonical confirmation and refresh receipts before continuing' : 'Faucet is already verified')
      if (this.#prepared && this.prepared) {
        this.#prepared.review.workflowId = setup.id
        this.#prepared.review.workflowStep = step
        this.prepared.workflowId = setup.id
        this.prepared.workflowStep = step
      }
    })
  }
  cancelPrepared() {
    this.#prepared = undefined
    this.prepared = undefined
    this.#change()
  }
  #saveActivity(activity: Activity[]) {
    this.#storage.setItem(ACTIVITY, JSON.stringify(activity))
    this.activity = activity
  }
  async submitPrepared() {
    return this.#run(async () => {
      const pending = this.#prepared
      const profile = this.#profile()
      if (!pending || this.prepared?.id !== pending.review.id || !this.walletUnlocked || pending.profileId !== profile.id)
        throw new Error('Prepare and review a transaction on the selected chain first')
      if (Date.now() - pending.review.createdAt >= 120000) { this.cancelPrepared(); throw new Error('Review expired after two minutes; prepare again') }
      const status = await this.#status(profile)
      this.#ready(status)
      if (!this.walletUnlocked || this.#prepared !== pending) throw new Error('Wallet was locked or review cancelled during verification')
      if (status.nonce + 1 !== pending.nonce) { this.cancelPrepared(); throw new Error('Account nonce changed; prepare and review again') }
      if (parseUnits(status.balance) < pending.cost) throw new Error('Balance changed; insufficient funds for the reviewed transaction')
      let history = this.activity
      if (history.length >= 200) {
        const completed = history.findIndex(entry => !entry.workflowId && ['confirmed', 'failed'].includes(entry.status))
        if (completed < 0) throw new Error('Activity storage is full; reconcile outstanding transactions')
        history = history.filter((_, index) => index !== completed)
      }
      const hash = await new TransactionMessage(pending.transaction).hash()
      if (!this.walletUnlocked || this.#prepared !== pending) throw new Error('Wallet was locked or review cancelled before submission')
      const entry: Activity = {
        id: crypto.randomUUID(), profileId: profile.id, chainId: profile.chainId, hash, kind: pending.review.kind,
        status: 'submitting', createdAt: Date.now(), contractAddress: pending.review.contractAddress,
        workflowId: pending.review.workflowId, workflowStep: pending.review.workflowStep
      }
      this.#saveActivity([entry, ...history])
      if (entry.workflowId) this.faucetStep = 'waiting'
      this.cancelPrepared()
      try {
        const response = await this.#request(profile, { action: 'submit', transaction: pending.transaction, contract: pending.contract })
        this.#applyReceipt(entry, response)
        this.#saveActivity(this.activity.map(item => item.id === entry.id ? entry : item))
        this.notice = entry.status === 'confirmed' ? 'Transaction canonically confirmed.'
          : entry.status === 'failed' ? `Transaction failed: ${entry.error || 'Execution rejected'}`
          : entry.status === 'unknown' ? 'Submission could not be verified. Check activity and reconcile with the operator; do not resend.'
          : 'Transaction submitted. Refresh activity to check canonical confirmation; do not resend.'
      } catch (error) {
        entry.status = 'unknown'
        entry.error = `${message(error)}. Submission may have reached the node. Reconcile before sending again.`
        this.#saveActivity(this.activity.map(item => item.id === entry.id ? entry : item))
        throw error
      }
    })
  }
  #applyReceipt(entry: Activity, value: unknown) {
    if (!isRecord(value) || value.hash !== entry.hash || typeof value.status !== 'string' ||
        !['submitting', 'pending', 'confirmed', 'failed', 'unknown'].includes(value.status))
      throw new Error('Invalid transaction receipt')
    entry.status = value.status as Activity['status']
    entry.error = typeof value.error === 'string' ? value.error : undefined
  }
  async refreshActivity() {
    return this.#run(async () => {
      const profile = this.#profile()
      await this.#status(profile)
      const history = structuredClone(this.activity)
      for (const entry of history) {
        if (entry.profileId !== profile.id || !['submitting', 'pending', 'unknown'].includes(entry.status)) continue
        this.#applyReceipt(entry, await this.#request(profile, { action: 'receipt', hash: entry.hash }))
      }
      this.#saveActivity(history)
    })
  }
}
