const cache = {}

const timeout = () => {
  setTimeout(() => {
    for (var key of Object.keys(cache)) {
      delete cache[key]
    }
    timeout()
  }, 120000);
}

timeout()

export default cache
