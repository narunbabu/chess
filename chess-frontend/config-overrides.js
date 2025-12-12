const { override, addWebpackPlugin, overrideDevServer } = require('customize-cra');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = override(
  // Enable compression for production builds - SAFE
  (config) => {
    if (process.env.NODE_ENV === 'production') {
      // Keep source maps for debugging (remove this line if not needed)
      // config.devtool = false;

      // Add compression plugin - SAFE
      config.plugins.push(
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        })
      );

      // Optimize chunk splitting - PERFORMANCE OPTIMIZED
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 5, // CRITICAL: Limit parallel CSS requests
        maxAsyncRequests: 3,   // Reduce async chunk count
        cacheGroups: {
          // CSS Optimization: Merge all CSS into fewer chunks
          defaultVendors: false, // Disable default vendor splitting
          default: false,        // Disable default splitting

          // Single vendor bundle for all node_modules
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 20,
            enforce: true, // Force single vendor chunk
          },
          // Single common bundle for shared app code
          common: {
            minChunks: 2,
            name: 'common',
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true, // Force single common chunk
          },
        },
      };

      // Reduce bundle size - SAFE
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    return config;
  }
);