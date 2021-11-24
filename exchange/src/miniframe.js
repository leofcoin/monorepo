import miniframe from './../../miniframe/src/miniframe'
globalThis.miniframe = miniframe
globalThis.BaseClass = miniframe.helpers.BaseClass
globalThis.html = miniframe.utils.html
globalThis.pubsub = miniframe.pubsub

export default miniframe
