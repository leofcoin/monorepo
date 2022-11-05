const path = require('path');
const webpack = require('webpack');
module.exports = [{
  mode: 'production',
  entry: {
    chain: './dist/module/chain.js',
    node: './dist/module/node.js'
  },
  plugins: [
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
        process: 'process/browser',
    }),
    new webpack.ProvidePlugin({
      WRTC_IMPORT: `globalThis.wrtc = {
        RTCPeerConnection,
        RTCSessionDescription,
        RTCIceCandidate
      }`
    })
  ],
  optimization: {
    minimize: false
  },
  resolve: {
    // extensions: [ '.ts', '.js' ],
    fallback: {
      'vm': require.resolve("vm-browserify"),
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "child_process": false,
      "fs": false,
      "util": false,
      // "assert": require.resolve("assert/"),
    }
  },
  output: {
    library: {
      type: 'module'
    },
    publicPath: '',
    filename: '[name].browser.js',
    chunkFilename: '[name].browser.js',
    path: path.resolve(__dirname, 'dist'),
  },
  experiments: {
    outputModule: true
  }
}, {
  mode: 'production',
  entry: {
    'machine-worker': './dist/module/workers/machine-worker.js',
    'block-worker': './dist/module/workers/block-worker.js',
    'transaction-worker': './dist/module/workers/transaction-worker.js',
    'pool-worker': './dist/module/workers/pool-worker.js'
  },
  plugins: [
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
        process: 'process/browser',
    }),
    new webpack.ProvidePlugin({
      WRTC_IMPORT: `globalThis.wrtc = {
        RTCPeerConnection,
        RTCSessionDescription,
        RTCIceCandidate
      }`
    })
  ],
  optimization: {
    minimize: false
  },
  resolve: {
    // extensions: [ '.ts', '.js' ],
    fallback: {
      'vm': require.resolve("vm-browserify"),
      'path': require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "os": require.resolve("os-browserify/browser"),
      // "buffer": require.resolve("buffer"),
      "fs": false,
      "util": false,
      "child_process": false,
      // "assert": require.resolve("assert/"),
    }
  },
  output: {
    library: {
      type: 'module'
    },
    publicPath: '',
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/browser/workers'),
  },
  experiments: {
    outputModule: true
  }
}];
