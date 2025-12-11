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

      // Optimize chunk splitting - OPTIMIZED
      config.optimization.splitChunks = {
        chunks: 'all',
        maxSize: 244000, // ~244KB chunks for better caching
        cacheGroups: {
          // React and core libraries
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 30,
          },
          // Chess libraries
          chess: {
            test: /[\\/]node_modules[\\/](chess\.js|react-chessboard)[\\/]/,
            name: 'chess',
            chunks: 'all',
            priority: 25,
          },
          // UI libraries (MUI)
          mui: {
            test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
            name: 'mui',
            chunks: 'all',
            priority: 20,
          },
          // Router and navigation
          router: {
            test: /[\\/]node_modules[\\/](react-router-dom)[\\/]/,
            name: 'router',
            chunks: 'all',
            priority: 15,
          },
          // Other vendors
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            minChunks: 1,
          },
          // Common code across app
          common: {
            minChunks: 2,
            name: 'common',
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
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