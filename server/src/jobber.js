const cache = {}

const getTime = () => {
  return Math.round(new Date().getTime() / 1000)
}

const timeout = () => {
  setTimeout(async () => {
    const start = getTime()
    for (var key of Object.keys(cache)) {
      await cache[key].job()
      console.log(`job ${key} took ${getTime() - start}s`);
    }

    console.log(`jobs took ${getTime() - start}s`);
    timeout()
  }, 120 * 1000);
}

timeout()

export default cache
