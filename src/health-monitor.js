/**
 * Health Monitoring and Diagnostics
 * Provides server health checks, metrics, and diagnostics
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.startTime = Date.now();
    this.metrics = {
      requests: {
        total: 0,
        errors: 0,
        by_method: new Map(),
        response_times: []
      },
      events: {
        total: 0,
        by_type: new Map(),
        processing_times: []
      },
      sessions: {
        total: 0,
        active: 0,
        peak_concurrent: 0
      },
      memory: {
        current_mb: 0,
        peak_mb: 0,
        gc_count: 0
      },
      errors: []
    };

    this.alertThresholds = {
      memory_mb: options.maxMemoryMB || 512,
      response_time_ms: options.maxResponseTimeMS || 1000,
      error_rate: options.maxErrorRate || 0.05, // 5%
      queue_size: options.maxQueueSize || 1000
    };

    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30s
    this.metricsRetention = options.metricsRetention || 300; // Keep 300 recent samples

    this.startHealthChecks();
    this.setupGCMonitoring();
  }

  /**
   * Record a request
   * @param {string} method - MCP method name
   * @param {number} startTime - Request start time
   * @param {boolean} success - Whether request succeeded
   * @param {number} endTime - Request end time
   */
  recordRequest(method, startTime, success = true, endTime = performance.now()) {
    const responseTime = endTime - startTime;
    
    this.metrics.requests.total++;
    if (!success) this.metrics.requests.errors++;
    
    // Track by method
    const methodStats = this.metrics.requests.by_method.get(method) || { count: 0, errors: 0, avg_time: 0 };
    methodStats.count++;
    if (!success) methodStats.errors++;
    methodStats.avg_time = (methodStats.avg_time * (methodStats.count - 1) + responseTime) / methodStats.count;
    this.metrics.requests.by_method.set(method, methodStats);

    // Track response times (keep recent samples)
    this.metrics.requests.response_times.push({
      timestamp: Date.now(),
      method,
      time: responseTime,
      success
    });

    if (this.metrics.requests.response_times.length > this.metricsRetention) {
      this.metrics.requests.response_times.shift();
    }

    // Check for slow requests
    if (responseTime > this.alertThresholds.response_time_ms) {
      this.emitAlert('slow_request', {
        method,
        response_time: responseTime,
        threshold: this.alertThresholds.response_time_ms
      });
    }
  }

  /**
   * Record an event
   * @param {string} eventType - Type of event
   * @param {number} processingTime - Time to process event
   */
  recordEvent(eventType, processingTime = 0) {
    this.metrics.events.total++;
    
    // Track by type
    const typeCount = this.metrics.events.by_type.get(eventType) || 0;
    this.metrics.events.by_type.set(eventType, typeCount + 1);

    // Track processing times
    if (processingTime > 0) {
      this.metrics.events.processing_times.push({
        timestamp: Date.now(),
        type: eventType,
        time: processingTime
      });

      if (this.metrics.events.processing_times.length > this.metricsRetention) {
        this.metrics.events.processing_times.shift();
      }
    }
  }

  /**
   * Record session metrics
   * @param {number} totalSessions - Total sessions created
   * @param {number} activeSessions - Currently active sessions
   */
  recordSessions(totalSessions, activeSessions) {
    this.metrics.sessions.total = totalSessions;
    this.metrics.sessions.active = activeSessions;
    
    if (activeSessions > this.metrics.sessions.peak_concurrent) {
      this.metrics.sessions.peak_concurrent = activeSessions;
    }
  }

  /**
   * Record an error
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   */
  recordError(error, context = 'unknown') {
    const errorRecord = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context,
      type: error.constructor.name
    };

    this.metrics.errors.unshift(errorRecord);
    
    // Keep only recent errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.pop();
    }

    // Check error rate
    const recentRequests = this.getRecentRequests(60000); // Last minute
    if (recentRequests.length > 10) {
      const errorRate = this.metrics.requests.errors / this.metrics.requests.total;
      if (errorRate > this.alertThresholds.error_rate) {
        this.emitAlert('high_error_rate', {
          current_rate: errorRate,
          threshold: this.alertThresholds.error_rate,
          recent_requests: recentRequests.length
        });
      }
    }

    this.emit('error_recorded', errorRecord);
  }

  /**
   * Get current health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const memUsage = process.memoryUsage();
    const currentMemoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Update memory metrics
    this.metrics.memory.current_mb = currentMemoryMB;
    if (currentMemoryMB > this.metrics.memory.peak_mb) {
      this.metrics.memory.peak_mb = currentMemoryMB;
    }

    const uptime = Date.now() - this.startTime;
    const recentRequests = this.getRecentRequests(60000); // Last minute
    const avgResponseTime = this.getAverageResponseTime();
    const errorRate = this.metrics.requests.total > 0 ? 
      this.metrics.requests.errors / this.metrics.requests.total : 0;

    const status = {
      status: this.determineOverallHealth(),
      uptime_ms: uptime,
      uptime_human: this.formatUptime(uptime),
      memory: {
        current_mb: currentMemoryMB,
        peak_mb: this.metrics.memory.peak_mb,
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        external_mb: Math.round(memUsage.external / 1024 / 1024)
      },
      requests: {
        total: this.metrics.requests.total,
        errors: this.metrics.requests.errors,
        error_rate: errorRate,
        requests_per_minute: recentRequests.length,
        avg_response_time_ms: avgResponseTime
      },
      events: {
        total: this.metrics.events.total,
        events_per_minute: this.getRecentEvents(60000).length
      },
      sessions: {
        total: this.metrics.sessions.total,
        active: this.metrics.sessions.active,
        peak_concurrent: this.metrics.sessions.peak_concurrent
      }
    };

    return status;
  }

  /**
   * Get detailed metrics
   * @returns {Object} Detailed metrics
   */
  getDetailedMetrics() {
    const health = this.getHealthStatus();
    
    return {
      ...health,
      method_breakdown: Object.fromEntries(this.metrics.requests.by_method),
      event_type_breakdown: Object.fromEntries(this.metrics.events.by_type),
      recent_errors: this.metrics.errors.slice(0, 10),
      response_time_percentiles: this.calculateResponseTimePercentiles(),
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Determine overall health status
   * @returns {string} Health status
   * @private
   */
  determineOverallHealth() {
    const memUsage = this.metrics.memory.current_mb;
    const errorRate = this.metrics.requests.total > 0 ? 
      this.metrics.requests.errors / this.metrics.requests.total : 0;
    const avgResponseTime = this.getAverageResponseTime();

    if (memUsage > this.alertThresholds.memory_mb) return 'critical';
    if (errorRate > this.alertThresholds.error_rate) return 'critical';
    if (avgResponseTime > this.alertThresholds.response_time_ms * 2) return 'critical';
    
    if (memUsage > this.alertThresholds.memory_mb * 0.8) return 'warning';
    if (errorRate > this.alertThresholds.error_rate * 0.5) return 'warning';
    if (avgResponseTime > this.alertThresholds.response_time_ms) return 'warning';
    
    return 'healthy';
  }

  /**
   * Get recent requests
   * @param {number} timeWindow - Time window in ms
   * @returns {Array} Recent requests
   * @private
   */
  getRecentRequests(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.metrics.requests.response_times.filter(req => req.timestamp > cutoff);
  }

  /**
   * Get recent events
   * @param {number} timeWindow - Time window in ms
   * @returns {Array} Recent events
   * @private
   */
  getRecentEvents(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.metrics.events.processing_times.filter(event => event.timestamp > cutoff);
  }

  /**
   * Get average response time
   * @returns {number} Average response time in ms
   * @private
   */
  getAverageResponseTime() {
    const recent = this.getRecentRequests(300000); // Last 5 minutes
    if (recent.length === 0) return 0;
    
    const total = recent.reduce((sum, req) => sum + req.time, 0);
    return Math.round(total / recent.length);
  }

  /**
   * Calculate response time percentiles
   * @returns {Object} Percentile data
   * @private
   */
  calculateResponseTimePercentiles() {
    const recent = this.getRecentRequests(300000);
    if (recent.length === 0) return {};

    const times = recent.map(r => r.time).sort((a, b) => a - b);
    
    return {
      p50: this.getPercentile(times, 50),
      p90: this.getPercentile(times, 90),
      p95: this.getPercentile(times, 95),
      p99: this.getPercentile(times, 99)
    };
  }

  /**
   * Get percentile value
   * @param {Array} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   * @private
   */
  getPercentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * (percentile / 100)) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Format uptime for human readability
   * @param {number} uptimeMs - Uptime in milliseconds
   * @returns {string} Formatted uptime
   * @private
   */
  formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Emit health alert
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   * @private
   */
  emitAlert(type, data) {
    const alert = {
      type,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(type)
    };

    console.error(`[ALERT] ${type}:`, data);
    this.emit('alert', alert);
  }

  /**
   * Get alert severity
   * @param {string} type - Alert type
   * @returns {string} Severity level
   * @private
   */
  getAlertSeverity(type) {
    const severities = {
      'slow_request': 'warning',
      'high_error_rate': 'critical',
      'memory_high': 'warning',
      'memory_critical': 'critical'
    };
    return severities[type] || 'info';
  }

  /**
   * Get active alerts (alerts from last 10 minutes)
   * @returns {Array} Active alerts
   * @private
   */
  getActiveAlerts() {
    // This would be populated by recent alert emissions
    // For now, return empty array - could be enhanced to track recent alerts
    return [];
  }

  /**
   * Start periodic health checks
   * @private
   */
  startHealthChecks() {
    setInterval(() => {
      const health = this.getHealthStatus();
      
      // Check memory usage
      if (health.memory.current_mb > this.alertThresholds.memory_mb) {
        this.emitAlert('memory_critical', {
          current_mb: health.memory.current_mb,
          threshold_mb: this.alertThresholds.memory_mb
        });
      } else if (health.memory.current_mb > this.alertThresholds.memory_mb * 0.8) {
        this.emitAlert('memory_high', {
          current_mb: health.memory.current_mb,
          threshold_mb: this.alertThresholds.memory_mb * 0.8
        });
      }

      this.emit('health_check', health);
    }, this.healthCheckInterval);
  }

  /**
   * Setup garbage collection monitoring
   * @private
   */
  setupGCMonitoring() {
    if (global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        this.metrics.memory.gc_count++;
        return originalGC();
      };
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.requests = {
      total: 0,
      errors: 0,
      by_method: new Map(),
      response_times: []
    };
    this.metrics.events = {
      total: 0,
      by_type: new Map(),
      processing_times: []
    };
    this.metrics.errors = [];
    this.startTime = Date.now();
  }
}