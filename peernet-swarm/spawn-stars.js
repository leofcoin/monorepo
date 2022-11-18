const {spawn} = require('child_process')

const networks = [{
  name: 'leofcoin:peach',
  port: 44444
}]


for (const [port, name] of networks) {
  spawn('./spawn-star.js', ['--port', port, '--network', name])
}
