/** Freeze declarations, not decoded messages. Keep existing consumer field types mutable. */
export const defineSchema = <T extends object>(proto: T): T => Object.freeze(proto) as T
