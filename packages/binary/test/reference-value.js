// Frozen pre-optimization encoder: test/benchmark oracle only, never a runtime fallback.
import { BinaryReader, BinaryWriter, varUintLength } from '../exports/framing.js';
export const BINARY_CONTENT_TYPE = 'application/octet-stream';
const MAGIC = new Uint8Array([0x4c, 0x46, 0x43, 1]);
const utf8 = new TextEncoder();
const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const defaults = { maxBytes: 16 * 1024 * 1024, maxDepth: 64, maxNodes: 200000 };
const limitsFor = (options) => {
    const limits = { ...defaults, ...options };
    for (const value of Object.values(limits))
        if (!Number.isSafeInteger(value) || value < 1)
            throw new RangeError('Invalid binary limits');
    return limits;
};
const length = (value) => new BinaryWriter(varUintLength(value)).writeVarUint(value).finish();
/** Versioned canonical typed values. Never JSON; numbers, BigInts and bytes retain their types. */
export function encodeReferenceValue(value, options = {}) {
    const limits = limitsFor(options);
    const chunks = [MAGIC];
    const ancestors = new Set();
    let size = MAGIC.length;
    let nodes = 0;
    const put = (bytes) => {
        size += bytes.length;
        if (size > limits.maxBytes)
            throw new RangeError('Binary value exceeds byte limit');
        chunks.push(bytes);
    };
    const tag = (value) => put(Uint8Array.of(value));
    const string = (value) => {
        if (value.length > limits.maxBytes)
            throw new RangeError('Invalid binary string');
        const bytes = utf8.encode(value);
        if (text.decode(bytes) !== value)
            throw new RangeError('Invalid binary string');
        put(length(bytes.length));
        put(bytes);
    };
    const write = (value, depth) => {
        if (++nodes > limits.maxNodes || depth > limits.maxDepth)
            throw new RangeError('Binary value exceeds complexity limit');
        if (value === undefined)
            return tag(0);
        if (value === null)
            return tag(1);
        if (value === false)
            return tag(2);
        if (value === true)
            return tag(3);
        if (typeof value === 'number') {
            if (!Number.isFinite(value))
                throw new TypeError('Binary numbers must be finite');
            tag(4);
            const bytes = new Uint8Array(8);
            new DataView(bytes.buffer).setFloat64(0, value, false);
            return put(bytes);
        }
        if (typeof value === 'bigint') {
            tag(value < 0n ? 6 : 5);
            const magnitude = value < 0n ? -value : value;
            return put(new BinaryWriter(37).writeVarBigInt(magnitude).finish());
        }
        if (typeof value === 'string') {
            tag(7);
            return string(value);
        }
        if (value instanceof Uint8Array) {
            tag(8);
            put(length(value.length));
            return put(value);
        }
        if (typeof value !== 'object')
            throw new TypeError('Unsupported binary value');
        if (ancestors.has(value))
            throw new TypeError('Cyclic binary value');
        ancestors.add(value);
        try {
            if (Array.isArray(value)) {
                if (Object.keys(value).length !== value.length || Object.getOwnPropertySymbols(value).length)
                    throw new TypeError('Binary arrays cannot have extra properties or holes');
                tag(9);
                put(length(value.length));
                if (value.length > limits.maxNodes - nodes)
                    throw new RangeError('Binary array exceeds node limit');
                for (let index = 0; index < value.length; index++) {
                    const entry = Object.getOwnPropertyDescriptor(value, String(index));
                    if (!entry || !('value' in entry))
                        throw new TypeError('Sparse arrays and accessors are not binary values');
                    write(entry.value, depth + 1);
                }
            }
            else {
                if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
                    throw new TypeError('Binary maps must be plain objects');
                const keys = Object.keys(value).sort();
                if (Object.getOwnPropertySymbols(value).length)
                    throw new TypeError('Symbol keys are not binary values');
                if (keys.length > limits.maxNodes - nodes)
                    throw new RangeError('Binary map exceeds node limit');
                tag(10);
                put(length(keys.length));
                for (const key of keys) {
                    const entry = Object.getOwnPropertyDescriptor(value, key);
                    if (!('value' in entry))
                        throw new TypeError('Accessors are not binary values');
                    string(key);
                    write(entry.value, depth + 1);
                }
            }
        }
        finally {
            ancestors.delete(value);
        }
    };
    write(value, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
    }
    return output;
}
