const NFC_SUPPORT = globalThis.NDEFReader
let ignoreRead
let ndefReader
export function write(data) {
  ignoreRead = true
  return new Promise((resolve, reject) => {
    if (NFC_SUPPORT) {
      ndefReader.addEventListener(
        'reading',
        (event) => {
          // Check if we want to write to this tag, or reject.
          ndefReader
            .write(data)
            .then(resolve, reject)
            .finally(() => (ignoreRead = false))
        },
        { once: true }
      )
    }
  })
}

if (NFC_SUPPORT) {
  ndefReader = new globalThis.NDEFReader()
  await ndefReader.scan()

  ndefReader.onreading = (event) => {
    if (ignoreRead) {
      return // write pending, ignore read.
    }
    const externalRecord = event.message.records.find((record) => record.type === 'https://leofcoin.org:smart-poster')

    let action, text

    for (const record of externalRecord.toRecords()) {
      if (record.recordType === 'text') {
        const decoder = new TextDecoder(record.encoding)
        text = decoder.decode(record.data)
      } else if (record.recordType === ':act') {
        action = record.data.getUint8(0)
      }
    }

    switch (action) {
      case 0: // do the action
        console.log(`receiving payment request ${text}`)
        break
      case 1: // save for later
        console.log(`sending payment request ${text}`)
        break
    }
  }
}

export { NFC_SUPPORT }
