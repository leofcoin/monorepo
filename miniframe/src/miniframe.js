import Pubsub from './../node_modules/@vandeurenglenn/little-pubsub/src/index'
import helpers from './helpers/helpers.js'
import utils from './utils/utils.js'
import styles from './styles/styles.js'
import load from './load/load.js'

const pubsub = globalThis.pubsub || new Pubsub()

export default {
  pubsub,
  helpers,
  utils,
  styles,
  load
}
