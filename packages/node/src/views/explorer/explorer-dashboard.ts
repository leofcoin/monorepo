import { html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import '../../elements/explorer/info-container.js'
import { formatBytes, formatUnits } from '@leofcoin/utils'
import '@vandeurenglenn/flex-elements/wrap-around.js'
import { BlockMessage } from '@leofcoin/messages'
import './../../elements/explorer/dashboard-section.js'
import './../../elements/explorer/dashboard-charts.js'
import type { DashboardBlockPoint } from '../../elements/explorer/dashboard-charts.js'
import { getSelectedNetwork } from '../../network-selection.js'
import '../../elements/explorer/dashboard-rankings.js'
import { rankActivity, rankHolders } from '../../controllers/explorer-rankings.js'
import { errorMessage } from '../../controllers/transfer.js'
import { getExplorerSource } from '../../controllers/public-explorer.js'

export default customElements.define(
  'explorer-dashboard',
  class ExplorerDashboard extends LiteElement {
    @property() accessor items: { title: string; items: [] }[]

    @property() accessor validators: any[]

    @property({ type: Boolean, consumes: true }) accessor nodeStarted = false

    @property({ type: Boolean, consumes: true }) accessor isNodeReady = false

    @property({ type: String, consumes: true }) accessor nodeStartError = ''

    #subscriptions: Array<() => void> = []
    #updating = false
    @property({ type: String }) accessor dashboardError = ''
    @property({ type: String }) accessor sourceMode = ''

    updateInfo = async () => {
      if (this.#updating) return
      this.#updating = true
      try {
        this.dashboardError = ''
        await this.#updateInfo()
      } catch (error) {
        this.dashboardError = errorMessage(error)
      } finally {
        this.#updating = false
      }
    }

    async #updateInfo() {
      const source = await getExplorerSource()
      this.sourceMode = source.kind
      const client = source.client
      if (!client) throw new Error('Node data is not ready yet. Retry after startup.')
      const promises = []

      const lookupValidators = await client.lookup('LeofcoinValidators')

      const lookupFactory = await client.lookup('LeofcoinContractFactory')
      promises.push(await client.staticCall(lookupValidators.address, 'validators', []))
      promises.push(BigInt(await client.nativeTransfers()).toString())
      promises.push(BigInt(await client.nativeBurns()).toString())
      promises.push(BigInt(await client.nativeMints()).toString())
      promises.push(BigInt(await client.nativeCalls()).toString())
      promises.push(BigInt(await client.totalContracts()).toString())
      promises.push(BigInt(await client.staticCall(lookupFactory.address, 'totalContracts', [])).toString())
      promises.push(await client.lastBlockHeight())
      promises.push(BigInt(await client.totalTransactions()).toString())
      promises.push(formatBytes(await client.totalSize()))
      promises.push(await client.transactionsInPool())
      promises.push(formatBytes(await client.transactionPoolSize()))
      promises.push((await client.peers()).length)

      // execute all promises in parallel for performance reasons

      await Promise.all(promises)
      this.validators = promises[0]

      // transactions
      this.nativeTransfers = promises[1]
      this.nativeBurns = promises[2]
      this.nativeMints = promises[3]
      this.nativeCalls = promises[4]
      this.totalContracts = promises[5]
      this.registeredContracts = promises[6]

      // chain
      this.lastBlockHeight = promises[7]
      this.totalTransactions = promises[8]
      this.totalSize = promises[9]

      // pool
      this.transactionsInPool = promises[10]
      this.transactionPoolSize = promises[11]

      // network
      this.peers = promises[12]
      // validators
      this.totalValidators = Object.keys(this.validators).length
      const records = Object.values(this.validators) as any[]
      this.onlineValidators = records.length && records.every(record => record && Number.isFinite(record.lastSeen))
        ? records.filter(record => Date.now() - record.lastSeen >= 0 && Date.now() - record.lastSeen < 60_000).length : undefined
      const chartBlocks: DashboardBlockPoint[] = []
      let previousTimestamp: number | undefined

      const chartMessages: BlockMessage[] = []
      const rankingBlocks = []
      let blocks = await client.blocks(-128)
      for (let block of blocks) {
        const message = new BlockMessage(block)
        chartMessages.push(message)
        block = message.decoded
        rankingBlocks.push(block)
        const transactions = block.transactions ?? []
        const timestamp = Number(block.timestamp)
        chartBlocks.push({
          index: Number(block.index),
          transactions: transactions.length,
          timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
          validators: block.validators?.length ?? 0,
          fees: block.fees !== undefined ? formatUnits(block.fees) : undefined,
          blockTime:
            previousTimestamp !== undefined && Number.isFinite(timestamp)
              ? Math.max(0, (timestamp - previousTimestamp) / 1000)
              : undefined
        })
        if (Number.isFinite(timestamp)) previousTimestamp = timestamp
      }
      const recent = chartBlocks.slice(-48)
      const recentMessages = chartMessages.slice(-48)
      await Promise.all(
        recent.map(async (point, i) => {
          try {
            point.hash = await recentMessages[i].hash()
          } catch {
            point.hash = undefined
          }
        })
      )
      this.chartBlocks = recent
      const unresolved = rankingBlocks.some(block => block.transactions.some(transaction => typeof transaction === 'string'))
      this.activityError = unresolved ? 'Transaction bodies are not resolved for this sample. Browse Transactions to inspect them.' : ''
      this.activityRankings = rankActivity(unresolved ? [] : rankingBlocks)
      try {
        this.holderRankings = source.getHolderRankings ? await source.getHolderRankings() : rankHolders(await client.balances())
        this.holderError = ''
      } catch (error) {
        this.holderRankings = undefined
        this.holderError = `Holder ranking unavailable: ${errorMessage(error)}`
      } finally {
        this.holdersLoading = false
      }

      // Block transaction counts are not a measured transactions-per-second rate.
      this.tps = undefined
    }
    @property({ type: Number }) accessor onlineValidators: number
    @property({ type: Number }) accessor totalValidators: number
    @property({ type: String }) accessor nativeMints: string
    @property({ type: String }) accessor nativeBurns: string
    @property({ type: String }) accessor nativeTransfers: string
    @property({ type: Number }) accessor totalContracts: number
    @property({ type: String }) accessor registeredContracts: string
    @property({ type: String }) accessor nativeCalls: string
    @property({ type: Number }) accessor lastBlockHeight: number
    @property({ type: String }) accessor totalTransactions: string
    @property({ type: String }) accessor totalSize: string
    @property({ type: Number }) accessor transactionsInPool: number
    @property({ type: String }) accessor transactionPoolSize: string
    @property({ type: Number }) accessor peers: number
    @property({ type: Number }) accessor tps: number
    @property({ type: Array }) accessor chartBlocks: DashboardBlockPoint[] = []
    @property({ type: Object }) accessor activityRankings = rankActivity([])
    @property({ type: String }) accessor activityError = ''
    @property({ type: Object }) accessor holderRankings: ReturnType<typeof rankHolders> | undefined
    @property({ type: String }) accessor holderError = ''
    @property({ type: Boolean }) accessor holdersLoading = true

    connectedCallback() {
      super.connectedCallback()
      const bus = globalThis.pubsub
      if (bus) for (const event of ['chain:ready', 'node:ready', 'block-loaded', 'explorer:source-ready']) {
        const handler = (block) => { if (event !== 'block-loaded' || block && typeof block === 'object') void this.updateInfo() }
        bus.subscribe(event, handler)
        this.#subscriptions.push(() => bus.unsubscribe(event, handler, { keepValue: true }))
      }
      void this.updateInfo()
    }

    disconnectedCallback() {
      super.disconnectedCallback()
      for (const unsubscribe of this.#subscriptions.splice(0)) unsubscribe()
    }

    render() {
      return html`
        <style>
          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            align-items: center;
            overflow-y: auto;
            padding: 12px;
            box-sizing: border-box;
          }

          flex-wrap-evenly {
            padding: 48px;
            box-sizing: border-box;
            overflow-y: auto;
          }

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            -webkit-box-shadow: inset 0 0 6px rgb(73 78 112);
            border-radius: 10px;
            margin: 12px 0;
          }
          ::-webkit-scrollbar-thumb {
            border-radius: 10px;
            -webkit-box-shadow: inset 0 0 6px rgba(225, 255, 255, 0.5);
          }

          explorer-info {
            margin-bottom: 6px;
            max-height: 126px;
            width: calc(100% / 2 - 3px);
          }

          @media (max-width: 721px) {
            hero-element {
              width: 100%;
            }
            :host {
              align-items: none;
              justify-content: none;
            }
          }
        </style>
        ${this.nodeStarted && this.nativeMints && !this.isNodeReady
          ? html`<p>Node is syncing. Rankings reflect the current local chain, not necessarily the network tip.</p>` : ''}
        ${this.nodeStartError || this.dashboardError
          ? html`<div role="alert"><h3>Dashboard unavailable</h3><p>${this.nodeStartError || this.dashboardError}</p><button @click=${this.updateInfo}>Try again</button></div>`
          : !this.nodeStarted && this.sourceMode !== 'public'
          ? html`<h3>Connecting to explorer data…</h3>`
          : !this.isNodeReady && this.sourceMode !== 'public'
          ? html`<h3>Connecting dashboard to ${getSelectedNetwork().label}...</h3>`
          : this.nativeMints
          ? html` <explorer-dashboard-charts
                .blocks=${this.chartBlocks}
                .height=${this.lastBlockHeight}
                .totalTransactions=${this.totalTransactions}
                .totalSize=${this.totalSize}
                .peers=${this.peers}
                .tps=${this.tps}
                .totalValidators=${this.totalValidators}
                .onlineValidators=${this.onlineValidators}
                .native=${{
                  transfers: this.nativeTransfers,
                  calls: this.nativeCalls,
                  mints: this.nativeMints,
                  burns: this.nativeBurns
                }}></explorer-dashboard-charts>

              <explorer-dashboard-rankings
                .activity=${this.activityRankings}
                .activityError=${this.activityError}
                .holders=${this.holderRankings}
                .holderError=${this.holderError}
                .loading=${this.holdersLoading}></explorer-dashboard-rankings>

              <explorer-dashboard-section
                .items=${[
                  {
                    title: 'Contracts',
                    icon: 'contract',
                    items: [
                      { title: 'total', value: this.totalContracts, icon: 'content_copy' },
                      { title: 'registered', value: this.registeredContracts, icon: 'storage' }
                    ]
                  },
                  {
                    title: 'Pool',
                    icon: 'pool',
                    items: [
                      { title: 'size', value: this.transactionPoolSize, icon: 'storage' },
                      { title: 'transactions', value: this.transactionsInPool, icon: 'list' }
                    ]
                  }
                ]}></explorer-dashboard-section>`
          : html`<h3>Loading dashboard data...</h3>`}
        <flex-wrap-around>
          ${map(
            this.items,
            (item, index) =>
              html` <explorer-info title=${item.title} .items=${item.items} index=${index}></explorer-info> `
          )}
        </flex-wrap-around>
      `
    }
  }
)
