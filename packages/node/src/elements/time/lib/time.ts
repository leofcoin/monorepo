export const interval = () => {
  if (!globalThis.__interval__)
    globalThis.__interval__ = setInterval(() => {
      pubsub.publish('interval:1000')
    }, 1000)
}
