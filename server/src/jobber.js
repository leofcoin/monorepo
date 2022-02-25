const cache = {}

const getTime = () => {
  return Math.round(new Date().getTime() / 1000)
}

const timeout = () => {
  setTimeout(async () => {
    const start = getTime()
    let i = 0
    for (const key of Object.keys(cache)) {
      cache[key].job().then(() => {
        i++
        console.log(`job ${key} took ${getTime() - start}s`);
        if (Object.keys(cache).length === i) timeout()
      })
    }
  }, 1 * 60 * 1000);
}

timeout()
globalThis.jobber = cache
export default cache
