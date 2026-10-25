import assert from 'node:assert/strict'
import test from 'node:test'
import { createGenesisPlan, GENESIS_RUNTIME, GENESIS_PLAN_SCHEMA } from '@leofcoin/lib/genesis-plan'
import { verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import { ContractMessage } from '@leofcoin/messages'
import { generateGenesisBundle } from '../dist/genesis.js'
import { extractGenesis } from '../scripts/extract-genesis.js'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const address = 'YTqyQkkaMKMTShz7LQh8XdxdZ2GPsXkd1bYHpqQWEF7tQyABZ9DGb'
const plan = await createGenesisPlan({
  schema: GENESIS_PLAN_SCHEMA, version: 1, label: 'Operator genesis', ...GENESIS_RUNTIME,
  genesisValidator: address, targetSupply: '1000', initialSupply: '100',
  allocations: [{ address, amount: '100' }], stars: []
})
test('generated bundle contains actual reproducible genesis contract messages and verified identity', async () => {
  const bundle = await generateGenesisBundle(plan)
  assert.equal(bundle.schema, 'leofcoin:genesis-bundle:v1')
  assert.equal((await verifyChainIdentity(bundle.identity)).chainId, plan.chainId)
  for (const name of ['nativeToken', 'contractFactory', 'validators', 'nameService']) {
    const message = new ContractMessage(bundle.bytecodes[name])
    assert.equal(await message.hash(), bundle.addresses[name])
    assert.equal(bundle.identity.genesisContracts[name], bundle.addresses[name])
    assert.equal(message.decoded.creator, address)
    assert.ok(message.decoded.contract.length > 0)
  }
  assert.deepEqual(await generateGenesisBundle(plan), bundle)
  assert.deepEqual(bundle.plan, plan)
  assert.match(bundle.fingerprint, /^[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(bundle), /password|mnemonic|privateKey/)
})
test('genesis generation refuses plans with a stale or forged ID', async () => {
  await assert.rejects(generateGenesisBundle({ ...plan, initialSupply: '101', allocations: [{ address, amount: '101' }] }), /Chain ID does not match/)
})

test('bundle extraction verifies every artifact and refuses existing output directories', async t => {
  const root = await mkdtemp(join(tmpdir(), 'manager-genesis-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const input = join(root, 'bundle.json')
  const output = join(root, 'fresh-genesis')
  const bundle = await generateGenesisBundle(plan)
  await writeFile(input, JSON.stringify(bundle))
  assert.equal(await extractGenesis(input, output), plan.chainId)
  assert.deepEqual(JSON.parse(await readFile(join(output, 'bytecodes.json'), 'utf8')), bundle.bytecodes)
  await assert.rejects(extractGenesis(input, output), /exist/i)
  bundle.bytecodes.nativeToken = bundle.bytecodes.validators
  await writeFile(input, JSON.stringify(bundle))
  await assert.rejects(extractGenesis(input, join(root, 'tampered')), /bytecodes differs/)
})
