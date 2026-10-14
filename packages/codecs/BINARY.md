# Binary Reader/Writer

`@leofcoin/codecs/binary` is a dependency-free shared implementation of unsigned
base-128 integers and length-prefixed byte frames. Numeric values retain the
existing wire bytes. No chain field, codec identifier, hash algorithm or supply
representation changes as part of this migration.

```js
import { BinaryReader, BinaryWriter, varUintLength } from '@leofcoin/codecs/binary'

const signature = new Uint8Array(64)
const writer = new BinaryWriter(varUintLength(1) + varUintLength(129) + signature.length)
writer.writeVarUint(1).writeVarUint(129).writeBytes(signature)
const reader = new BinaryReader(writer.finish())
const version = reader.readVarUint()
const codec = reader.readVarUint()
const decodedSignature = reader.readBytes(reader.remaining)
```

- `writeVarUint` / `readVarUint`: unsigned safe-integer Numbers, at most 8 bytes.
- `writeVarBigInt` / `readVarBigInt`: unsigned BigInts through `2^256-1`, at most 37 bytes.
- `writeFrame` / `readFrame`: Number length prefix plus bytes. A failed operation
  does not advance the cursor. Writes check capacity before changing bytes.
- `encodeFrames` / `decodeFrames`: a sequence of those frames; optional raw prefix
  bytes on encode, corresponding prefix length on decode. Encoding allocates one
  output buffer, without allocating a varint array for every field. Decoding is
  iterative, so many fields do not exhaust the call stack.

Readers return **views**, not copies; modifying a view modifies the input buffer.
`writer.finish()` likewise returns a view. Use `finish(true)` to retain an
independent copy before resetting/reusing a writer. Writers have fixed capacity;
the caller supplies the capacity or an existing Uint8Array. There is no hidden
buffer growth or mutable process-global `.bytes` state.

New reader calls reject padded/non-canonical integers by default. Existing block
validator framing explicitly uses `canonical: false` to preserve legacy padded
prefix acceptance. Tightening that consensus rule needs a separate protocol
decision. Overflow and truncated fields still fail closed. `decodeFrames` accepts
an optional `maxFrames` policy; network size/membership limits remain the caller's
responsibility. BigInt support does not automatically migrate existing fields.

Checks: `npm test -w @leofcoin/codecs`, `npm test -w @leofcoin/messages`.
Benchmark: `node test/bench/binary-codec.js`. It compares the actual installed
legacy framing packages and verifies equal bytes before measuring. Results are
local CPU timings, not blockchain throughput or transport latency claims.
