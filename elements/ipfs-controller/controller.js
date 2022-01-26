const initialSetup = async (strap, address) => {
  strap.push(address)
  await ipfs.config.set('Bootstrap', strap)
  await ipfs.swarm.connect(address)
}

export default async (address = '/dns4/star.leofcoin.org/tcp/4003/wss/p2p/QmfShD2oP9b51eGPCNPHH3XC8K28VLXtgcR7fhpqJxNzH4') => {
  if (!globalThis.ipfs) {
    const loadScript = () => new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.onload = () => resolve();
      script.onerror = () => reject();
      script.setAttribute('async', '')
      script.src = 'https://cdn.jsdelivr.net/npm/ipfs@latest/index.min.js'
      document.head.appendChild(script)
    })


    await loadScript()
    console.log(globalThis.ipfs, globalThis.Ipfs);
    globalThis.ipfs = await Ipfs.create({
      repo: 'test',
      libp2p: {
        config: {
          dht: {
            enabled: true
          },
          relay: {
            enabled: true, // enable relay dialer/listener (STOP)
          }
        }
      }

    })
  }
  // const strap = await ipfs.config.get('Bootstrap')
  // if (strap.indexOf(address) === -1) await initialSetup(strap, address)
  return ipfs
}
