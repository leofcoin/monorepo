const randombytes = (strength) => crypto.getRandomValues(new Uint8Array(strength))

export { randombytes as default }
