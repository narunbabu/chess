const { override, addWebpackPlugin } = require('customize-cra');
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

      // Optimize chunk splitting - SAFE
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            minChunks: 2,
            name: 'common',
            chunks: 'all',
            priority: 5,
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