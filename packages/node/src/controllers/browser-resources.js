// No legacy performance.memory: a JS heap is not total application RAM.
export function browserResources({ navigator = globalThis.navigator, performance = globalThis.performance,
  isolated = globalThis.crossOriginIsolated } = {}) {
  const threads = navigator?.hardwareConcurrency
  const memoryReason = !isolated ? 'Memory measurement requires a cross-origin-isolated page.'
    : typeof performance?.measureUserAgentSpecificMemory !== 'function' ? 'This browser does not expose application memory measurements.' : ''
  return { threads: Number.isSafeInteger(threads) && threads > 0 ? threads : null, memoryReason }
}

const pending = new WeakMap()
export async function measureBrowserMemory({ performance = globalThis.performance,
  isolated = globalThis.crossOriginIsolated, timeoutMs = 30000 } = {}) {
  const { memoryReason } = browserResources({ performance, isolated })
  if (memoryReason) throw new Error(memoryReason)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid measurement timeout')
  // A timed-out browser measurement cannot be cancelled. Reuse it on retry
  // instead of stacking expensive garbage-collection-triggering requests.
  let measurement = pending.get(performance)
  if (!measurement) {
    measurement = Promise.resolve().then(() => performance.measureUserAgentSpecificMemory()).then(result => {
      if (!Number.isSafeInteger(result?.bytes) || result.bytes < 0) throw new Error('The browser returned an invalid memory measurement.')
      return result.bytes
    })
    pending.set(performance, measurement)
    const clear = () => { if (pending.get(performance) === measurement) pending.delete(performance) }
    measurement.then(clear, clear)
  }
  let timer
  try {
    return await Promise.race([measurement, new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Memory measurement timed out. Retry to check the pending sample.')), timeoutMs)
    })])
  } finally { clearTimeout(timer) }
}
