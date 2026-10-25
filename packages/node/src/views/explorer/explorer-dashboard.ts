import { html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import '../../elements/explorer/info-container.js'
import { formatBytes, formatUnits } from '@leofcoin/utils'
import '@vandeurenglenn/flex-elements/wrap-around.js'
import { BlockMessage } from '@leofcoin/messages'
import { state } from '../../state/state.js'
import './../../elements/explorer/dashboard-section.js'
import './../../elements/explorer/dashboard-charts.js'
import type { DashboardBlockPoint } from '../../elements/explorer/dashboard-charts.js'
import { getSelectedNetwork } from '../../network-selection.js'
import '../../elements/explorer/dashboard-rankings.js'
import { rankActivity, rankHolders } from '../../controllers/explorer-rankings.js'
import { errorMessage } from '../../controllers/transfer.js'

export default customElements.define(
  'explorer-dashboard',
  class ExplorerDashboard extends LiteElement {
    @property() accessor items: { title: string; items: [] }[]

    @property() accessor validators: any[]

    @property({ type: Boolean, consumes: true }) accessor nodeStarted = false

    @property({ type: Boolean, consumes: true }) accessor isNodeReady = false

    @property({ type: String, consumes: true }) accessor nodeStartError = ''

    #clientSubscribed = false
    #updating = false

    updateInfo = async () => {
      if (this.#updating) return
      this.#updating = true
      try {
        await this.#updateInfo()
      } finally {
        this.#updating = false
      }
    }

    async #updateInfo() {
      const promises = []

      const lookupValidators = await client.lookup('LeofcoinValidators')

      const lookupFactory = await client.lookup('LeofcoinContractFactory')
      promises.push(await client.staticCall(lookupValidators.address, 'validators', {}))
      promises.push(BigInt(await client.nativeTransfers()).toString())
      promises.push(BigInt(await client.nativeBurns()).toString())
      promises.push(BigInt(await client.nativeMints()).toString())
      promises.push(BigInt(await client.nativeCalls()).toString())
      promises.push(BigInt(await client.totalContracts()).toString())
      promises.push(BigInt(await client.staticCall(lookupFactory.address, 'totalContracts')).toString())
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
      this.onlineValidators = Object.values(this.validators).filter(
        ({ lastSeen }) => lastSeen - new Date().getTime() < 60_000
      ).length

      const tpeses = []
      const chartBlocks: DashboardBlockPoint[] = []
      let previousTimestamp: number | undefined

      const chartMessages: BlockMessage[] = []
      const rankingBlocks = []
      let blocks = await client.blocks(-128)
      for (let block of blocks) {
        const message = new BlockMessage(new Uint8Array(Object.values(block)))
        chartMessages.push(message)
        block = message.decoded
        rankingBlocks.push(block)
        const transactions = block.transactions ?? []
        block.tps = 0

        let start = transactions[0]?.timestamp
        for (const transaction of transactions) {
          if (start - transaction.timestamp <= 1000) {
            block.tps += 1
          }
        }

        tpeses.push(block.tps)

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
      this.activityRankings = rankActivity(rankingBlocks)
      try {
        this.holderRankings = rankHolders(await client.balances())
        this.holderError = ''
      } catch (error) {
        this.holderRankings = undefined
        this.holderError = `Holder ranking unavailable: ${errorMessage(error)}`
      } finally {
        this.holdersLoading = false
      }

      const median = (arr) => {
        const mid = Math.floor(arr.length / 2),
          nums = [...arr].sort((a, b) => a - b)
        return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
      }

      this.tps = median(tpeses)
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
    @property({ type: Object }) accessor holderRankings: ReturnType<typeof rankHolders> | undefined
    @property({ type: String }) accessor holderError = ''
    @property({ type: Boolean }) accessor holdersLoading = true

    async beforeRender() {
      await state.ready
    }

    async firstRender(): Promise<void> {
      pubsub.subscribe('chain:ready', this.updateInfo)
      pubsub.subscribe('node:ready', async () => {
        this.#subscribeClient()
        await this.updateInfo()
      })
      if (globalThis.chain && globalThis.client) {
        this.#subscribeClient()
        await this.updateInfo()
      }
    }

    #subscribeClient() {
      if (this.#clientSubscribed || !globalThis.client) return
      const clientPubsub = globalThis.client.pubsub
      clientPubsub.subscribe('add-block', this.updateInfo)
      clientPubsub.subscribe('block-processed', this.updateInfo)
      this.#clientSubscribed = true
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
        ${this.nodeStartError
          ? html`<h3>Dashboard unavailable: ${this.nodeStartError}</h3>`
          : !this.nodeStarted
          ? html`<h3>Unlock your wallet to start the dashboard.</h3>`
          : !this.isNodeReady
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
