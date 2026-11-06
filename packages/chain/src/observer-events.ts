type ObserverBus = {
  publish(topic: string, value: any): unknown
  // Public LittlePubSub API. Custom buses without this registry remain
  // responsible for isolating their own individual listeners.
  subscribers?: Map<string, { value?: any; handlers: Array<{ bound: (value: any, oldValue?: any) => unknown }> }>
  verbose?: boolean
}

/** Observation only: never use this for consensus votes or worker/RPC replies. */
export function publishObserverEvent(bus: ObserverBus, topic: string, payload: unknown,
  onError: (topic: string, error: unknown) => void = (topic, error) => console.warn(`[chain observer] ${topic}:`, error)) {
  const report = (error: unknown) => {
    try { onError(topic, error) } catch { /* Diagnostics must not affect the writer either. */ }
  }
  const invoke = (callback: () => unknown) => {
    try {
      const result = callback()
      if (result && typeof (result as any).then === 'function') Promise.resolve(result).catch(report)
    } catch (error) { report(error) }
  }
  try {
    // Observers may change their input, but never the canonical header/cache.
    const value = structuredClone(payload)
    if (!(bus.subscribers instanceof Map)) {
      invoke(() => bus.publish(topic, value))
      return
    }
    let subscriber = bus.subscribers.get(topic)
    if (!subscriber) {
      subscriber = { handlers: [], value: undefined }
      bus.subscribers.set(topic, subscriber)
    }
    const oldValue = subscriber.value
    if (!bus.verbose && oldValue === value) return
    subscriber.value = value
    // Snapshot before invoking: once()/unsubscribe() can mutate the live array.
    for (const handler of [...subscriber.handlers]) invoke(() => handler.bound(value, oldValue))
  } catch (error) { report(error) }
}
