const { override, addWebpackPlugin, overrideDevServer } = require('customize-cra');
const CompressionPlugin = require('compression-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

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

      // Optimize chunk splitting - PERFORMANCE OPTIMIZED FOR INITIAL LOAD
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 3, // CRITICAL: Minimize initial requests
        maxAsyncRequests: 5,   // Allow more async chunks
        cacheGroups: {
          defaultVendors: false, // Disable default vendor splitting
          default: false,        // Disable default splitting

          // Single vendor bundle for all node_modules JavaScript ONLY
          vendors: {
            test: /[\\/]node_modules[\\/].*\.(js|jsx|ts|tsx)$/,
            name: 'vendors',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
          // DO NOT create common CSS bundle - let each route load its own CSS
          // Only create common JS bundle for code used on multiple routes
          common: {
            test: /\.(js|jsx|ts|tsx)$/, // JavaScript only, NOT CSS
            minChunks: 2,
            name: 'common',
            chunks: 'initial', // Only for initial load, not async
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };

      // CSS Optimization - CRITICAL
      config.optimization.minimizer = [
        ...config.optimization.minimizer,
        new CssMinimizerPlugin({
          minimizerOptions: {
            preset: [
              'default',
              {
                discardComments: { removeAll: true },
                normalizeWhitespace: true,
              },
            ],
          },
        }),
      ];

      // Optimize CSS extraction
      const miniCssExtractPlugin = config.plugins.find(
        plugin => plugin instanceof MiniCssExtractPlugin
      );
      if (miniCssExtractPlugin) {
        miniCssExtractPlugin.options.ignoreOrder = true;
      }

      // NOTE: Optimization disabled to prevent breaking game logic
      // The 'usedExports' and 'sideEffects' optimizations break event listeners, timers, and WebSocket connections
      // config.optimization.usedExports = true; // DISABLED - breaks game timer functionality
      // config.optimization.sideEffects = false; // DISABLED - breaks game logic

      // Image optimization configuration
      config.module.rules.push({
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8kb - inline small images
          },
        },
        generator: {
          filename: 'static/media/[name].[hash:8][ext]',
        },
      });
    }

    return config;
  }
);