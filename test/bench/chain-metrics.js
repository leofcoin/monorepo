import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

export function cpuMilliseconds(value) {
  let days = 0
  if (value.includes('-')) { const parts = value.split('-'); days = Number(parts[0]); value = parts[1] }
  const parts = value.split(':').map(Number)
  if (parts.some(value => !Number.isFinite(value)) || parts.length < 2 || parts.length > 3) throw new Error('Invalid ps CPU time')
  return ((days * 86400) + (parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1])) * 1000
}

export function descendants(rows, roots) {
  const selected = new Set(roots)
  let changed
  do {
    changed = false
    for (const row of rows) if (!selected.has(row.pid) && selected.has(row.parent)) { selected.add(row.pid); changed = true }
  } while (changed)
  return rows.filter(row => selected.has(row.pid))
}

/** Main processes plus canonical/read workers. RSS is summed (shared pages may be counted twice). */
export class TreeMetrics {
  constructor(roots) {
    this.roots = roots
    this.last = new Map()
    this.start = new Map()
    this.peakRssBytes = 0
    this.samples = 0
    this.ticks = process.platform === 'linux' ? Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim()) : 100
  }
  async sample(initial = false) {
    const output = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,time='], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
    const rows = output.trim().split('\n').map(line => {
      const [pid, parent, rss, cpu] = line.trim().split(/\s+/)
      return { pid: Number(pid), parent: Number(parent), rss: Number(rss) * 1024, cpu: cpuMilliseconds(cpu) }
    })
    let rss = 0
    const selected = descendants(rows, this.roots)
    for (const row of selected) {
      if (process.platform === 'linux') {
        try {
          const text = await readFile(`/proc/${row.pid}/stat`, 'utf8')
          const fields = text.slice(text.lastIndexOf(')') + 2).split(' ')
          row.cpu = (Number(fields[11]) + Number(fields[12])) * 1000 / this.ticks
        } catch { continue } // A benchmark worker can exit between ps and /proc.
      }
      rss += row.rss
      this.last.set(row.pid, row.cpu)
      if (initial) this.start.set(row.pid, row.cpu)
    }
    this.peakRssBytes = Math.max(this.peakRssBytes, rss)
    this.samples++
  }
  async begin() {
    await this.sample(true)
    this.tail = Promise.resolve()
    this.timer = setInterval(() => { this.tail = this.tail.then(() => this.sample()).catch(error => { this.error = error }) }, 100)
  }
  async end() {
    clearInterval(this.timer)
    await this.tail
    await this.sample()
    if (this.error) throw this.error
    return { sampledCpuMs: [...this.last].reduce((sum, [pid, cpu]) => sum + Math.max(0, cpu - (this.start.get(pid) || 0)), 0),
      peakAggregateRssBytes: this.peakRssBytes, samples: this.samples, processes: this.last.size,
      cpuResolutionMs: 1000 / this.ticks, rssIsUniquePhysicalMemory: false }
  }
}
