import BinaryWorker from '../exports/binary-worker.js'
const worker = new BinaryWorker()
let rawIsBytes = false
process.on('message', bytes => { rawIsBytes = bytes instanceof Uint8Array })
worker.onmessage(value => worker.postMessage({ rawIsBytes, value }))
