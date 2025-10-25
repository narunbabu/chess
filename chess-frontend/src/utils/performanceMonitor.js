/**
 * Performance monitoring for game optimizations
 * Tracks metrics, measures improvements, and provides insights
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      websocket: {
        messages: 0,
        bytesSent: 0,
        bytesReceived: 0,
        compressionRatios: [],
        messageTimes: []
      },
      timers: {
        localUpdates: 0,
        serverSyncs: 0,
        syncErrors: 0
      },
      compression: {
        originalSize: 0,
        compressedSize: 0,
        operations: 0
      },
      memory: {
        initial: 0,
        snapshots: []
      }
    };

    this.startTime = Date.now();
    this.initialMemory = this.getMemoryUsage();

    console.log('📊 Performance Monitor initialized');
    this.startPeriodicReporting();
  }

  /**
   * Track WebSocket message performance
   */
  trackWebSocketMessage(direction, payload, compressed = false) {
    const size = this.calculateSize(payload);
    const timestamp = Date.now() - this.startTime;

    if (direction === 'sent') {
      this.metrics.websocket.messages++;
      this.metrics.websocket.bytesSent += size;
    } else {
      this.metrics.websocket.bytesReceived += size;
    }

    this.metrics.websocket.messageTimes.push({
      timestamp,
      direction,
      size,
      compressed
    });

    // Keep only last 100 messages for memory efficiency
    if (this.metrics.websocket.messageTimes.length > 100) {
      this.metrics.websocket.messageTimes.shift();
    }
  }

  /**
   * Track compression performance
   */
  trackCompression(originalSize, compressedSize) {
    this.metrics.compression.originalSize += originalSize;
    this.metrics.compression.compressedSize += compressedSize;
    this.metrics.compression.operations++;

    const ratio = compressedSize / originalSize;
    this.metrics.websocket.compressionRatios.push(ratio);

    // Keep only last 50 ratios
    if (this.metrics.websocket.compressionRatios.length > 50) {
      this.metrics.websocket.compressionRatios.shift();
    }
  }

  /**
   * Track timer performance
   */
  trackTimerLocalUpdate() {
    this.metrics.timers.localUpdates++;
  }

  trackTimerServerSync() {
    this.metrics.timers.serverSyncs++;
  }

  trackTimerSyncError() {
    this.metrics.timers.syncErrors++;
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot(label = '') {
    const current = this.getMemoryUsage();
    this.metrics.memory.snapshots.push({
      timestamp: Date.now() - this.startTime,
      label,
      memory: current
    });

    // Keep only last 20 snapshots
    if (this.metrics.memory.snapshots.length > 20) {
      this.metrics.memory.snapshots.shift();
    }
  }

  /**
   * Get current performance report
   */
  getPerformanceReport() {
    const now = Date.now() - this.startTime;
    const avgCompressionRatio = this.metrics.websocket.compressionRatios.length > 0
      ? this.metrics.websocket.compressionRatios.reduce((a, b) => a + b, 0) / this.metrics.websocket.compressionRatios.length
      : 1;

    const totalCompression = this.metrics.compression.operations > 0
      ? ((this.metrics.compression.originalSize - this.metrics.compression.compressedSize) / this.metrics.compression.originalSize * 100).toFixed(1)
      : 0;

    return {
      uptime: now,
      websocket: {
        totalMessages: this.metrics.websocket.messages,
        totalBytesSent: this.formatBytes(this.metrics.websocket.bytesSent),
        totalBytesReceived: this.formatBytes(this.metrics.websocket.bytesReceived),
        avgCompressionRatio: (avgCompressionRatio * 100).toFixed(1) + '%',
        totalSavings: totalCompression + '%'
      },
      timers: {
        localUpdates: this.metrics.timers.localUpdates,
        serverSyncs: this.metrics.timers.serverSyncs,
        syncErrors: this.metrics.timers.syncErrors,
        efficiency: this.metrics.timers.localUpdates > 0
          ? ((this.metrics.timers.localUpdates - this.metrics.timers.serverSyncs) / this.metrics.timers.localUpdates * 100).toFixed(1) + '%'
          : 'N/A'
      },
      memory: {
        initial: this.formatBytes(this.initialMemory),
        current: this.formatBytes(this.getMemoryUsage()),
        trend: this.getMemoryTrend()
      },
      compression: {
        operations: this.metrics.compression.operations,
        totalOriginal: this.formatBytes(this.metrics.compression.originalSize),
        totalCompressed: this.formatBytes(this.metrics.compression.compressedSize),
        savings: totalCompression + '%'
      }
    };
  }

  /**
   * Log performance report to console
   */
  logPerformanceReport() {
    const report = this.getPerformanceReport();

    console.log('📊 Performance Report');
    console.log('⏱️  Uptime:', (report.uptime / 1000).toFixed(1) + 's');
    console.log('');
    console.log('🌐 WebSocket Performance:');
    console.log('   Messages:', report.websocket.totalMessages);
    console.log('   Bytes Sent:', report.websocket.totalBytesSent);
    console.log('   Bytes Received:', report.websocket.totalBytesReceived);
    console.log('   Avg Compression:', report.websocket.avgCompressionRatio);
    console.log('');
    console.log('⏰ Timer Performance:');
    console.log('   Local Updates:', report.timers.localUpdates);
    console.log('   Server Syncs:', report.timers.serverSyncs);
    console.log('   Sync Errors:', report.timers.syncErrors);
    console.log('   Efficiency:', report.timers.efficiency);
    console.log('');
    console.log('💾 Memory Usage:');
    console.log('   Initial:', report.memory.initial);
    console.log('   Current:', report.memory.current);
    console.log('   Trend:', report.memory.trend);
    console.log('');
    console.log('🗜️  Compression:');
    console.log('   Operations:', report.compression.operations);
    console.log('   Total Original:', report.compression.totalOriginal);
    console.log('   Total Compressed:', report.compression.totalCompressed);
    console.log('   Overall Savings:', report.compression.savings);
  }

  /**
   * Start periodic performance reporting
   */
  startPeriodicReporting(intervalMs = 30000) {
    setInterval(() => {
      this.takeMemorySnapshot('periodic');
      this.logPerformanceReport();
    }, intervalMs);
  }

  /**
   * Calculate size of data
   */
  calculateSize(data) {
    if (!data) return 0;
    if (typeof data === 'string') return data.length;
    if (typeof data === 'object') {
      return JSON.stringify(data).length;
    }
    return 0;
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get memory trend
   */
  getMemoryTrend() {
    if (this.metrics.memory.snapshots.length < 2) return 'N/A';

    const recent = this.metrics.memory.snapshots.slice(-2);
    const diff = recent[1].memory - recent[0].memory;
    const percentChange = (diff / recent[0].memory * 100).toFixed(1);

    if (diff > 0) return '+' + percentChange + '%';
    return percentChange + '%';
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      websocket: {
        messages: 0,
        bytesSent: 0,
        bytesReceived: 0,
        compressionRatios: [],
        messageTimes: []
      },
      timers: {
        localUpdates: 0,
        serverSyncs: 0,
        syncErrors: 0
      },
      compression: {
        originalSize: 0,
        compressedSize: 0,
        operations: 0
      },
      memory: {
        initial: this.getMemoryUsage(),
        snapshots: []
      }
    };

    this.startTime = Date.now();
    console.log('📊 Performance Monitor reset');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();