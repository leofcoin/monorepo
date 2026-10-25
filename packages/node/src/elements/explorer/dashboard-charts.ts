import { LiteElement, html, css, property } from '@vandeurenglenn/lite'
import { svg } from 'lit-html'

export type DashboardBlockPoint = {
  index: number
  transactions: number
  blockTime?: number
  timestamp?: number
  hash?: string
  validators?: number
  fees?: string
}

type Tooltip = { x: number; y: number; title: string; rows: [string, string][]; hint?: string }

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const formatNumber = (value: number | string, digits = 0) => {
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(number)
    : String(value ?? '—')
}

const formatTime = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

const formatAgo = (timestamp?: number) => {
  if (!timestamp) return ''
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  return `${Math.round(seconds / 3600)}h ago`
}

class LfcCountUp extends HTMLElement {
  #value: number | string
  #frame = 0
  digits = 0
  suffix = ''

  set value(value: number | string) {
    const next = Number(value)
    const previous = Number(this.#value)
    this.#value = value
    cancelAnimationFrame(this.#frame)
    if (!Number.isFinite(next)) {
      this.textContent = value === undefined || value === null || value === '' ? '—' : String(value)
      return
    }
    const from = Number.isFinite(previous) ? previous : 0
    if (reducedMotion() || from === next) {
      this.textContent = formatNumber(next, this.digits) + this.suffix
      return
    }
    const start = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      this.textContent = formatNumber(from + (next - from) * eased, this.digits) + this.suffix
      if (progress < 1) this.#frame = requestAnimationFrame(tick)
    }
    this.#frame = requestAnimationFrame(tick)
  }

  get value() {
    return this.#value
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame)
  }
}

if (!customElements.get('lfc-count-up')) customElements.define('lfc-count-up', LfcCountUp)

export class ExplorerDashboardCharts extends LiteElement {
  static styles = [
    css`
      :host {
        --chart-blue: var(--lfc-action, #1d64d8);
        --chart-teal: #2fd6c3;
        --chart-muted: color-mix(in srgb, var(--md-sys-color-outline-variant) 55%, transparent);
        position: relative;
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 16px;
        width: 100%;
        max-width: 1200px;
        box-sizing: border-box;
        padding: 24px 24px 8px;
        color: var(--md-sys-color-on-surface);
      }

      .card {
        position: relative;
        box-sizing: border-box;
        border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 60%, transparent);
        border-radius: 18px;
        background: color-mix(in srgb, var(--md-sys-color-surface-container, #1d2230) 88%, transparent);
        padding: 20px;
        min-width: 0;
        animation: card-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        animation-delay: calc(var(--order, 0) * 60ms);
        transition: border-color 0.2s ease, background 0.2s ease;
      }

      .card:hover {
        border-color: color-mix(in srgb, var(--chart-blue) 55%, transparent);
      }

      .kpi {
        grid-column: span 3;
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow: hidden;
      }

      .kpi::after {
        content: '';
        position: absolute;
        inset: auto 20px 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: linear-gradient(90deg, var(--chart-blue), var(--chart-teal));
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.35s ease;
      }

      .kpi:hover::after {
        transform: scaleX(1);
      }

      .label {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant);
      }

      .value {
        font-size: 28px;
        font-weight: 700;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }

      .hint {
        font-size: 13px;
        color: var(--md-sys-color-on-surface-variant);
      }

      .wide {
        grid-column: span 8;
      }

      .side {
        grid-column: span 4;
      }

      .half {
        grid-column: span 6;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .live {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--chart-teal);
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--chart-teal) 60%, transparent);
        animation: pulse 2s ease-out infinite;
      }

      .segmented {
        display: inline-flex;
        padding: 3px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--md-sys-color-outline-variant) 30%, transparent);
      }

      .segmented button {
        border: 0;
        border-radius: 999px;
        padding: 4px 12px;
        background: transparent;
        color: var(--md-sys-color-on-surface-variant);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease;
      }

      .segmented button[aria-pressed='true'] {
        background: var(--chart-blue);
        color: #fff;
      }

      svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
        touch-action: pan-y;
      }

      .plot {
        cursor: crosshair;
      }

      .plot.clickable {
        cursor: pointer;
      }

      .axis {
        fill: var(--md-sys-color-on-surface-variant);
        font-size: 10px;
      }

      .grid {
        stroke: var(--chart-muted);
        stroke-width: 1;
      }

      .average {
        stroke: var(--chart-teal);
        stroke-width: 1;
        stroke-dasharray: 4 4;
        opacity: 0.8;
      }

      .bar {
        fill: var(--chart-blue);
        transform-box: fill-box;
        transform-origin: bottom;
        animation: grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        animation-delay: calc(var(--i, 0) * 14ms);
        transition: opacity 0.2s ease, fill 0.2s ease;
      }

      .bar.latest {
        fill: var(--chart-teal);
      }

      .bars.hovering .bar {
        opacity: 0.35;
      }

      .bars.hovering .bar.active {
        opacity: 1;
        fill: var(--md-sys-color-primary, #8bbcff);
      }

      .guide {
        stroke: var(--md-sys-color-on-surface-variant);
        stroke-width: 1;
        stroke-dasharray: 3 3;
        opacity: 0.6;
        pointer-events: none;
      }

      .line {
        fill: none;
        stroke: var(--chart-teal);
        stroke-width: 2.5;
        stroke-linejoin: round;
        stroke-linecap: round;
        stroke-dasharray: 1;
        animation: draw 1.2s cubic-bezier(0.4, 0, 0.2, 1) both;
      }

      .area {
        fill: url(#block-time-fill);
        animation: fade 1.2s ease both;
      }

      .point {
        fill: var(--md-sys-color-surface, #111);
        stroke: var(--chart-teal);
        stroke-width: 2.5;
        pointer-events: none;
      }

      .donut {
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .donut svg {
        width: 132px;
        flex-shrink: 0;
      }

      .ring {
        cursor: pointer;
        transition: stroke-width 0.2s ease, opacity 0.2s ease;
      }

      .ring.sweep {
        animation: sweep 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .ring.active {
        stroke-width: 16;
      }

      .donut-center {
        fill: currentColor;
        font-size: 24px;
        font-weight: 700;
      }

      .donut-sub {
        fill: var(--md-sys-color-on-surface-variant);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .legend {
        display: grid;
        gap: 10px;
        font-size: 14px;
      }

      .legend span {
        cursor: default;
        transition: opacity 0.2s ease;
      }

      .legend.hovering span:not(.active) {
        opacity: 0.4;
      }

      .dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: 8px;
        border-radius: 50%;
        vertical-align: middle;
      }

      .rows {
        display: grid;
        gap: 10px;
      }

      .row {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 6px 8px;
        margin: 0 -8px;
        border-radius: 10px;
        font-size: 14px;
        text-transform: capitalize;
        transition: background 0.2s ease;
      }

      .row:hover {
        background: color-mix(in srgb, var(--chart-blue) 14%, transparent);
      }

      .track {
        height: 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--md-sys-color-outline-variant) 45%, transparent);
        overflow: hidden;
      }

      .fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--chart-blue), var(--chart-teal));
        animation: fill-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        animation-delay: calc(var(--i, 0) * 90ms);
      }

      .row b {
        font-variant-numeric: tabular-nums;
      }

      .share {
        display: inline-block;
        min-width: 44px;
        margin-left: 8px;
        text-align: right;
        font-size: 12px;
        font-weight: 600;
        color: var(--md-sys-color-on-surface-variant);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .row:hover .share {
        opacity: 1;
      }

      .empty {
        padding: 32px 0;
        text-align: center;
        color: var(--md-sys-color-on-surface-variant);
      }

      .tooltip {
        position: absolute;
        z-index: 2;
        min-width: 150px;
        padding: 10px 12px;
        border: 1px solid color-mix(in srgb, var(--chart-blue) 45%, transparent);
        border-radius: 12px;
        background: color-mix(in srgb, var(--md-sys-color-surface-container-high, #262b38) 96%, transparent);
        backdrop-filter: blur(12px);
        color: var(--md-sys-color-on-surface);
        font-size: 12px;
        pointer-events: none;
        transform: translate(-50%, calc(-100% - 14px));
        animation: tooltip-in 0.15s ease both;
        white-space: nowrap;
      }

      .tooltip strong {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
      }

      .tooltip dl {
        display: grid;
        grid-template-columns: auto auto;
        gap: 4px 16px;
        margin: 0;
      }

      .tooltip dt {
        color: var(--md-sys-color-on-surface-variant);
      }

      .tooltip dd {
        margin: 0;
        text-align: right;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .tooltip .tip-hint {
        margin-top: 8px;
        color: var(--chart-teal);
        font-weight: 600;
      }

      @keyframes card-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }

      @keyframes grow {
        from {
          transform: scaleY(0);
        }
      }

      @keyframes draw {
        from {
          stroke-dashoffset: 1;
        }
        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes fade {
        from {
          opacity: 0;
        }
      }

      @keyframes sweep {
        from {
          stroke-dasharray: 0 999;
        }
      }

      @keyframes fill-in {
        from {
          width: 0;
        }
      }

      @keyframes tooltip-in {
        from {
          opacity: 0;
          margin-top: 4px;
        }
      }

      @keyframes pulse {
        70% {
          box-shadow: 0 0 0 8px transparent;
        }
        100% {
          box-shadow: 0 0 0 0 transparent;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        .card,
        .bar,
        .line,
        .area,
        .ring.sweep,
        .fill,
        .live,
        .tooltip {
          animation: none !important;
          transition: none !important;
        }
      }

      @media (max-width: 900px) {
        .kpi {
          grid-column: span 6;
        }
        .wide,
        .side,
        .half {
          grid-column: span 12;
        }
      }

      @media (max-width: 480px) {
        :host {
          padding: 12px;
          gap: 12px;
        }
        .value {
          font-size: 22px;
        }
      }
    `
  ]

  @property({ type: Array }) accessor blocks: DashboardBlockPoint[] = []
  @property({ type: Number }) accessor height: number
  @property({ type: String }) accessor totalTransactions: string
  @property({ type: String }) accessor totalSize: string
  @property({ type: Number }) accessor peers: number
  @property({ type: Number }) accessor tps: number
  @property({ type: Number }) accessor totalValidators = 0
  @property({ type: Number }) accessor onlineValidators = 0
  @property({ type: Object }) accessor native: Record<string, string> = {}

  @property({ type: Number }) accessor range = 24
  @property({ type: Number }) accessor hoverBar = -1
  @property({ type: Number }) accessor hoverTime = -1
  @property({ type: String }) accessor hoverRing = ''
  @property({ type: Object }) accessor tooltip: Tooltip | undefined

  get #visibleBlocks() {
    return (this.blocks ?? []).slice(-this.range)
  }

  #placeTooltip(event: PointerEvent, title: string, rows: [string, string][], hint?: string, anchorY?: number) {
    const host = this.getBoundingClientRect()
    this.tooltip = {
      x: Math.min(Math.max(event.clientX - host.left, 90), host.width - 90),
      y: (anchorY ?? event.clientY) - host.top,
      title,
      rows,
      hint
    }
  }

  #clearTooltip = () => {
    this.hoverBar = -1
    this.hoverTime = -1
    this.hoverRing = ''
    this.tooltip = undefined
  }

  #indexFromPointer(event: PointerEvent, count: number, inclusive = false) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 0.9999)
    return inclusive ? Math.round(ratio * (count - 1)) : Math.floor(ratio * count)
  }

  #onBarMove = (event: PointerEvent) => {
    const blocks = this.#visibleBlocks
    if (!blocks.length) return
    const index = this.#indexFromPointer(event, blocks.length)
    const block = blocks[index]
    this.hoverBar = index
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
    const max = Math.max(1, ...blocks.map((item) => item.transactions))
    const barTop = 180 - Math.max(2, (block.transactions / max) * 166)
    const rows: [string, string][] = [
      ['Transactions', formatNumber(block.transactions)],
      ['Time', formatTime(block.timestamp)]
    ]
    if (Number.isFinite(block.blockTime)) rows.push(['Block time', `${block.blockTime.toFixed(1)}s`])
    if (block.fees !== undefined) rows.push(['Fees', `${block.fees} LFC`])
    if (block.validators) rows.push(['Validators', String(block.validators)])
    this.#placeTooltip(
      event,
      `Block #${formatNumber(block.index)} · ${formatAgo(block.timestamp)}`,
      rows,
      block.hash ? 'Click to open block' : undefined,
      rect.top + (barTop / 200) * rect.height
    )
  }

  #onBarClick = () => {
    const block = this.#visibleBlocks[this.hoverBar]
    if (!block?.hash) return
    location.hash = `#!/explorer/block?selected=${block.hash}&index=${block.index}`
  }

  #onTimeMove = (event: PointerEvent) => {
    const points = this.#timePoints
    if (points.length < 2) return
    const index = this.#indexFromPointer(event, points.length, true)
    const point = points[index]
    this.hoverTime = index
    const average = points.reduce((sum, p) => sum + p.blockTime, 0) / points.length
    const delta = point.blockTime - average
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
    const max = Math.max(1, ...points.map((p) => p.blockTime)) * 1.1
    const pointY = 180 - (point.blockTime / max) * 180
    this.#placeTooltip(
      event,
      `Block #${formatNumber(point.index)}`,
      [
        ['Block time', `${point.blockTime.toFixed(2)}s`],
        ['vs average', `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}s`],
        ['Time', formatTime(point.timestamp)]
      ],
      undefined,
      rect.top + (pointY / 184) * rect.height
    )
  }

  #onRingMove = (event: PointerEvent, ring: 'online' | 'offline') => {
    const total = this.totalValidators || 0
    const online = Math.min(this.onlineValidators || 0, total)
    const count = ring === 'online' ? online : total - online
    this.hoverRing = ring
    this.#placeTooltip(event, ring === 'online' ? 'Online validators' : 'Offline validators', [
      ['Count', formatNumber(count)],
      ['Share', total ? `${Math.round((count / total) * 100)}%` : '—']
    ])
  }

  get #timePoints() {
    return this.#visibleBlocks.filter((block) => Number.isFinite(block.blockTime) && block.blockTime >= 0)
  }

  #transactionsChart() {
    const blocks = this.#visibleBlocks
    if (!blocks.length) return html`<div class="empty">No blocks yet</div>`
    const width = 640
    const height = 180
    const max = Math.max(1, ...blocks.map((block) => block.transactions))
    const average = blocks.reduce((sum, block) => sum + block.transactions, 0) / blocks.length
    const slot = width / blocks.length
    const barWidth = Math.max(2, slot * 0.68)
    const scale = (value: number) => (value / max) * (height - 14)
    const hovering = this.hoverBar >= 0
    const clickable = hovering && Boolean(blocks[this.hoverBar]?.hash)
    return html`<svg
      class="plot ${clickable ? 'clickable' : ''}"
      viewBox="0 0 ${width} ${height + 20}"
      role="img"
      aria-label="Transactions per block"
      @pointermove=${this.#onBarMove}
      @pointerleave=${this.#clearTooltip}
      @click=${this.#onBarClick}>
      ${svg`
        <line class="grid" x1="0" x2="${width}" y1="${height}" y2="${height}"></line>
        <line class="grid" x1="0" x2="${width}" y1="${height - scale(max / 2)}" y2="${height - scale(max / 2)}"></line>
        <text class="axis" x="0" y="${height - scale(max / 2) - 4}">${formatNumber(max / 2, max < 4 ? 1 : 0)}</text>
        <g class="bars ${hovering ? 'hovering' : ''}">
          ${blocks.map((block, i) => {
            const barHeight = Math.max(2, scale(block.transactions))
            const classes = ['bar', i === blocks.length - 1 ? 'latest' : '', i === this.hoverBar ? 'active' : '']
            return svg`<rect class="${classes.join(' ')}" style="--i:${i}" rx="3" x="${i * slot + (slot - barWidth) / 2}" y="${height - barHeight}" width="${barWidth}" height="${barHeight}"></rect>`
          })}
        </g>
        <line class="average" x1="0" x2="${width}" y1="${height - scale(average)}" y2="${height - scale(average)}"></line>
        <text class="axis" x="${width}" y="${height - scale(average) - 4}" text-anchor="end">avg ${average.toFixed(1)}</text>
        ${hovering ? svg`<line class="guide" x1="${(this.hoverBar + 0.5) * slot}" x2="${(this.hoverBar + 0.5) * slot}" y1="0" y2="${height}"></line>` : ''}
        <text class="axis" x="0" y="${height + 16}">#${formatNumber(blocks[0].index)}</text>
        <text class="axis" x="${width}" y="${height + 16}" text-anchor="end">#${formatNumber(blocks[blocks.length - 1].index)}</text>
      `}
    </svg>`
  }

  #blockTimeChart() {
    const points = this.#timePoints
    if (points.length < 2) return html`<div class="empty">Not enough blocks</div>`
    const width = 640
    const height = 180
    const max = Math.max(1, ...points.map((point) => point.blockTime)) * 1.1
    const step = width / (points.length - 1)
    const coords = points.map((point, i) => [i * step, height - (point.blockTime / max) * height])
    const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    const active = coords[this.hoverTime]
    return html`<svg
      class="plot"
      viewBox="0 0 ${width} ${height + 4}"
      role="img"
      aria-label="Block time"
      @pointermove=${this.#onTimeMove}
      @pointerleave=${this.#clearTooltip}>
      ${svg`
        <defs>
          <linearGradient id="block-time-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2fd6c3" stop-opacity="0.35"></stop>
            <stop offset="1" stop-color="#2fd6c3" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <line class="grid" x1="0" x2="${width}" y1="${height}" y2="${height}"></line>
        <line class="grid" x1="0" x2="${width}" y1="${height / 2}" y2="${height / 2}"></line>
        <text class="axis" x="0" y="${height / 2 - 4}">${(max / 2).toFixed(1)}s</text>
        <path class="area" d="${line} L${width} ${height} L0 ${height} Z"></path>
        <path class="line" pathLength="1" d="${line}"></path>
        ${active
          ? svg`
            <line class="guide" x1="${active[0]}" x2="${active[0]}" y1="0" y2="${height}"></line>
            <circle class="point" cx="${active[0]}" cy="${active[1]}" r="5"></circle>
          `
          : ''}
      `}
    </svg>`
  }

  #validatorsDonut() {
    const total = this.totalValidators || 0
    const online = Math.min(this.onlineValidators || 0, total)
    const radius = 48
    const circumference = 2 * Math.PI * radius
    const ratio = total ? online / total : 0
    const onlineLength = circumference * ratio
    const gap = online && total - online ? 4 : 0
    const ring = this.hoverRing
    return html`<div class="donut" @pointerleave=${this.#clearTooltip}>
      <svg viewBox="0 0 132 132" role="img" aria-label="${online} of ${total} validators online">
        ${svg`
          <circle class="ring ${ring === 'offline' ? 'active' : ''}" cx="66" cy="66" r="${radius}" fill="none"
            stroke="var(--chart-muted)" stroke-width="12"
            @pointermove=${(event: PointerEvent) => this.#onRingMove(event, 'offline')}></circle>
          ${online
            ? svg`<circle class="ring sweep ${ring === 'online' ? 'active' : ''}" cx="66" cy="66" r="${radius}" fill="none"
                stroke="var(--chart-teal)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${Math.max(0, onlineLength - gap)} ${circumference}" transform="rotate(-90 66 66)"
                @pointermove=${(event: PointerEvent) => this.#onRingMove(event, 'online')}></circle>`
            : ''}
          <text class="donut-center" x="66" y="68" text-anchor="middle">${Math.round(ratio * 100)}%</text>
          <text class="donut-sub" x="66" y="86" text-anchor="middle">online</text>
        `}
      </svg>
      <div class="legend ${ring ? 'hovering' : ''}">
        <span class="${ring === 'online' ? 'active' : ''}"
          ><i class="dot" style="background:var(--chart-teal)"></i>${online} online</span
        >
        <span class="${ring === 'offline' ? 'active' : ''}"
          ><i class="dot" style="background:var(--md-sys-color-outline-variant)"></i>${total - online} offline</span
        >
      </div>
    </div>`
  }

  #nativeActivity() {
    const entries = Object.entries(this.native ?? {}).map(([name, value]) => [name, Number(value) || 0] as const)
    const max = Math.max(1, ...entries.map(([, value]) => value))
    const total = entries.reduce((sum, [, value]) => sum + value, 0)
    return html`<div class="rows">
      ${entries.map(
        ([name, value], i) => html`<div class="row" title="${name}: ${formatNumber(value)}">
          <span>${name}</span>
          <div class="track"><div class="fill" style="--i:${i};width:${(value / max) * 100}%"></div></div>
          <b
            >${formatNumber(value)}<span class="share">${total ? `${Math.round((value / total) * 100)}%` : ''}</span></b
          >
        </div>`
      )}
    </div>`
  }

  #rangeControl() {
    return html`<div class="segmented" role="group" aria-label="Block range">
      ${[12, 24, 48].map(
        (range) =>
          html`<button
            type="button"
            aria-pressed=${String(this.range === range)}
            @click=${() => {
              this.#clearTooltip()
              this.range = range
            }}>
            ${range}
          </button>`
      )}
    </div>`
  }

  render() {
    const blocks = this.#visibleBlocks
    const averageTx = blocks.length ? blocks.reduce((sum, block) => sum + block.transactions, 0) / blocks.length : 0
    const times = this.#timePoints.map((block) => block.blockTime)
    const averageTime = times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : undefined
    const latest = this.blocks?.[this.blocks.length - 1]
    const tip = this.tooltip

    return html`
      <div class="card kpi" style="--order:0">
        <span class="label">Block height</span>
        <lfc-count-up class="value" .value=${this.height}></lfc-count-up>
        <span class="hint">${this.totalSize ?? '—'} on chain${latest?.timestamp ? ` · ${formatAgo(latest.timestamp)}` : ''}</span>
      </div>
      <div class="card kpi" style="--order:1">
        <span class="label">Transactions</span>
        <lfc-count-up class="value" .value=${this.totalTransactions}></lfc-count-up>
        <span class="hint">${averageTx.toFixed(1)} per block</span>
      </div>
      <div class="card kpi" style="--order:2">
        <span class="label">Block time</span>
        <lfc-count-up class="value" .digits=${1} .suffix=${'s'} .value=${averageTime ?? '—'}></lfc-count-up>
        <span class="hint">average, last ${blocks.length} blocks</span>
      </div>
      <div class="card kpi" style="--order:3">
        <span class="label">Network</span>
        <lfc-count-up class="value" .value=${this.peers ?? 0}></lfc-count-up>
        <span class="hint">peers · ${this.tps ?? 0} tps</span>
      </div>

      <section class="card wide" style="--order:4">
        <header>
          <h3><span class="live" aria-hidden="true"></span>Transactions per block</h3>
          ${this.#rangeControl()}
        </header>
        ${this.#transactionsChart()}
      </section>
      <section class="card side" style="--order:5">
        <header><h3>Validators</h3><span class="hint">${this.totalValidators} total</span></header>
        ${this.#validatorsDonut()}
      </section>

      <section class="card half" style="--order:6">
        <header><h3>Block time</h3><span class="hint">seconds between blocks</span></header>
        ${this.#blockTimeChart()}
      </section>
      <section class="card half" style="--order:7">
        <header><h3>Native activity</h3><span class="hint">all time</span></header>
        ${this.#nativeActivity()}
      </section>

      ${tip
        ? html`<div class="tooltip" role="status" style="left:${tip.x}px;top:${tip.y}px">
            <strong>${tip.title}</strong>
            <dl>${tip.rows.map(([label, value]) => html`<dt>${label}</dt><dd>${value}</dd>`)}</dl>
            ${tip.hint ? html`<div class="tip-hint">${tip.hint} →</div>` : ''}
          </div>`
        : ''}
    `
  }
}

customElements.define('explorer-dashboard-charts', ExplorerDashboardCharts)
