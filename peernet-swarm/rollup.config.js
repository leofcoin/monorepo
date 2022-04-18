import {execSync} from 'child_process'
import modify from 'rollup-plugin-modify'
try {
  execSync('rm ./dist/*.js')
} catch (e) {
  console.log('nothing to clean');
}

export default  [{
  input: ['src/index.js', 'src/server/server.js', 'src/client/client.js'],
  output: [{
    dir: './dist/es',
    format: 'es'
  }, {
    dir: './dist/commonjs',
    format: 'cjs',
    exports: 'auto'
  }],
  plugins: [
    modify({
      WRTC_IMPORT: `globalThis.wrtc = await import('wrtc')`
    })
  ]
}, {
  input: ['src/client/client.js'],
  output: [{
    dir: './dist/browser',
    format: 'es'
  }],
  plugins: [
    modify({
      WRTC_IMPORT: `globalThis.wrtc = {
        RTCPeerConnection,
        RTCSessionDescription,
        RTCIceCandidate
      }`
    })
  ]
}]
