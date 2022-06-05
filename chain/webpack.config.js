const path = require('path');
const webpack = require('webpack');
module.exports = [{
  mode: 'production',
  entry: {
    chain: './src/chain.js',
    node: './src/node.js'
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
      vm: require.resolve("vm-browserify"),
      // "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer")
      // fs: false,
      // "path": require.resolve("path-browserify"),
      // "util": require.resolve("util/"),
      // "assert": require.resolve("assert/"),
    }
  },
  output: {
    library: {
      type: 'module'
    },
    filename: '[name].browser.js',
    chunkFilename: '[name].browser.js',
    path: path.resolve(__dirname, 'dist'),
  },
  experiments: {
    outputModule: true
  }
}];
