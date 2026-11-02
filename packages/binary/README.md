# @leofcoin/binary

`@leofcoin/binary` is a dependency-free shared implementation of unsigned
base-128 integers and length-prefixed byte frames. Numeric values retain the
existing low-level framing bytes. The package also provides versioned typed-value
encoding for the application protocol described in [the wire specification](../../docs/binary-wire-protocol.md).

It is independent of `@leofcoin/codecs`, which remains the registry of codec
identifiers. This package does not import or re-export that registry.

```js
import { BinaryReader, BinaryWriter, varUintLength } from '@leofcoin/binary'

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

Reader calls reject padded/non-canonical integers by default. The typed-message
protocol requires canonical validator framing. An explicit `canonical: false`
option remains available for offline tooling, not as a network fallback.
Overflow and truncated fields fail closed. `decodeFrames` accepts an optional
`maxFrames` policy; network size/membership limits remain the caller's responsibility.

Checks: `npm test -w @leofcoin/binary`, `npm test -w @leofcoin/messages`.
Benchmark: `node test/bench/binary-codec.js`. It compares the actual installed
legacy framing packages and verifies equal bytes before measuring. Results are
local CPU timings, not blockchain throughput or transport latency claims.

## Typed-value encoder and framing

`encodeValue` validates and measures a flat per-call plan, then writes directly
into one exactly sized output byte buffer. Strings use allocation-free UTF-8
measurement and direct/encodeInto writes; BigInts use exact 49-bit limbs while
retaining the same unsigned-varint bytes. No scratch buffers or application
values are cached across calls.

`encodeValueWithPrefix(value, prefix, limits)` includes an existing codec/framing
header in that same allocation. The prefix is copied; `maxBytes` bounds the
typed value including its magic/version, separately from caller-provided framing.
Callers must keep framing bounded and enforce total network message limits.

Message schema compilation lives in `@leofcoin/messages`. Only frozen data-property
schemas cache field names, kinds and codec prefixes. Mutable caller schemas are
recompiled; decoded messages and caller-owned payloads are not frozen or cached.

## Reproducible performance comparison

Build first, then snapshot the **pre-change** binary/message outputs once:

```sh
node scripts/benchmark-wire-codecs.js --snapshot
```

Keep the returned directory. After rebuilding changed codecs:

```sh
node --expose-gc scripts/benchmark-wire-codecs.js <snapshot-directory>
```

Run from the repository root. The read-only benchmark checks identical bytes,
decoded values and block/transaction hashes before reporting timings. It uses
seven alternating samples, medians and source fingerprints. Message cases use
the actual BlockMessage/TransactionMessage classes with representative encoding
fixtures; they are not valid-consensus-block or end-to-end throughput benchmarks.
Snapshots are ignored generated artifacts under `node_modules/.cache`; never
refresh the baseline midway through a comparison. Rebuild dependencies and run
multi-node verification only after benchmarks, not concurrently with them.
