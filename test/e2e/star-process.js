import Server from '@netpeer/swarm/server'

const star = new Server(Number(process.env.LEOFCOIN_E2E_STAR_PORT), 'e2e')
setTimeout(() => process.stdout.write('E2E_STAR_READY\n'), 100)
setInterval(() => process.stdout.write(`E2E_STAR_PEERS:${star.peers.size}\n`), 250).unref()
