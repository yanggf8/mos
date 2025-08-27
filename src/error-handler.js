/**
 * Production Error Handling
 * Provides comprehensive error handling, recovery, and logging
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export class ErrorHandler {
  constructor(healthMonitor = null) {
    this.healthMonitor = healthMonitor;
    this.errorCounts = new Map();
    this.circuitBreakers = new Map();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {string} context - Context for error reporting
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  wrapWithErrorHandling(fn, context, options = {}) {
    const {
      retries = 0,
      timeout = 30000,
      fallback = null,
      circuitBreaker = false
    } = options;

    return async (...args) => {
      const startTime = performance.now();
      let lastError = null;

      // Check circuit breaker
      if (circuitBreaker && this.isCircuitOpen(context)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Circuit breaker open for ${context}`
        );
      }

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Add timeout if specified
          let result;
          if (timeout > 0) {
            result = await this.withTimeout(fn(...args), timeout);
          } else {
            result = await fn(...args);
          }

          // Record success
          if (this.healthMonitor) {
            this.healthMonitor.recordRequest(context, startTime, true);
          }
          
          // Reset circuit breaker on success
          if (circuitBreaker) {
            this.resetCircuitBreaker(context);
          }

          return result;

        } catch (error) {
          lastError = error;
          
          // Record attempt
          this.recordError(error, context, attempt);
          
          // Check if we should retry
          if (attempt < retries && this.shouldRetry(error)) {
            await this.delay(this.getBackoffDelay(attempt));
            continue;
          }

          // No more retries, handle the error
          break;
        }
      }

      // Record final failure
      if (this.healthMonitor) {
        this.healthMonitor.recordRequest(context, startTime, false);
        this.healthMonitor.recordError(lastError, context);
      }

      // Update circuit breaker
      if (circuitBreaker) {
        this.recordCircuitBreakerFailure(context);
      }

      // Try fallback
      if (fallback && typeof fallback === 'function') {
        try {
          console.warn(`Using fallback for ${context} after error:`, lastError.message);
          return await fallback(...args);
        } catch (fallbackError) {
          console.error(`Fallback failed for ${context}:`, fallbackError.message);
        }
      }

      // Transform error for MCP response
      throw this.transformError(lastError, context);
    };
  }

  /**
   * Handle MCP tool errors specifically
   * @param {Error} error - Original error
   * @param {string} toolName - Tool name
   * @param {Object} args - Tool arguments
   * @returns {McpError} Formatted MCP error
   */
  handleToolError(error, toolName, args = {}) {
    const context = `tool:${toolName}`;
    this.recordError(error, context);

    // Sanitize arguments for logging (remove sensitive data)
    const sanitizedArgs = this.sanitizeArgs(args);
    
    console.error(`Tool error in ${toolName}:`, {
      error: error.message,
      args: sanitizedArgs,
      stack: error.stack
    });

    // Determine appropriate error code
    let errorCode = ErrorCode.InternalError;
    if (error.name === 'ValidationError') {
      errorCode = ErrorCode.InvalidRequest;
    } else if (error.name === 'TimeoutError') {
      errorCode = ErrorCode.InternalError;
    } else if (error.message.includes('not found')) {
      errorCode = ErrorCode.InvalidRequest;
    }

    return new McpError(
      errorCode,
      `${toolName} failed: ${this.getSafeErrorMessage(error)}`
    );
  }

  /**
   * Handle session management errors
   * @param {Error} error - Original error
   * @param {string} sessionId - Session ID
   * @param {string} operation - Operation that failed
   * @returns {McpError} Formatted error
   */
  handleSessionError(error, sessionId, operation) {
    const context = `session:${operation}`;
    this.recordError(error, context);

    console.error(`Session error [${sessionId}] during ${operation}:`, error.message);

    if (error.message.includes('not found')) {
      return new McpError(
        ErrorCode.InvalidRequest,
        `Session ${sessionId} not found`
      );
    }

    return new McpError(
      ErrorCode.InternalError,
      `Session operation failed: ${operation}`
    );
  }

  /**
   * Handle streaming errors
   * @param {Error} error - Original error
   * @param {string} streamId - Stream ID
   * @returns {Object} Error response for stream
   */
  handleStreamError(error, streamId) {
    const context = `stream:${streamId}`;
    this.recordError(error, context);

    console.error(`Stream error [${streamId}]:`, error.message);

    return {
      error: true,
      message: this.getSafeErrorMessage(error),
      stream_id: streamId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Record error occurrence
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {number} attempt - Retry attempt number
   * @private
   */
  recordError(error, context, attempt = 0) {
    const key = `${context}:${error.name}`;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);

    // Log based on severity
    if (attempt === 0) {
      if (this.isCriticalError(error)) {
        console.error(`CRITICAL ERROR in ${context}:`, error.message, error.stack);
      } else {
        console.warn(`Error in ${context}:`, error.message);
      }
    } else {
      console.info(`Retry ${attempt} failed in ${context}:`, error.message);
    }
  }

  /**
   * Transform error for safe client consumption
   * @param {Error} error - Original error
   * @param {string} context - Error context
   * @returns {McpError} Transformed error
   * @private
   */
  transformError(error, context) {
    // Don't expose internal details in production
    const safeMessage = this.getSafeErrorMessage(error);
    
    if (error instanceof McpError) {
      return error;
    }

    // Map common error types
    if (error.name === 'ValidationError') {
      return new McpError(ErrorCode.InvalidRequest, safeMessage);
    }
    
    if (error.name === 'TimeoutError') {
      return new McpError(ErrorCode.InternalError, 'Operation timed out');
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new McpError(ErrorCode.InternalError, 'Service unavailable');
    }

    return new McpError(ErrorCode.InternalError, safeMessage);
  }

  /**
   * Get safe error message for clients
   * @param {Error} error - Error object
   * @returns {string} Safe error message
   * @private
   */
  getSafeErrorMessage(error) {
    // In production, don't expose internal details
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Generic messages for production
      const genericMessages = {
        'ValidationError': 'Invalid request parameters',
        'TimeoutError': 'Request timed out',
        'TypeError': 'Invalid request format',
        'SyntaxError': 'Invalid request syntax'
      };
      
      return genericMessages[error.name] || 'Internal server error';
    } else {
      // Detailed messages for development
      return error.message || 'Unknown error occurred';
    }
  }

  /**
   * Check if error should trigger retry
   * @param {Error} error - Error object
   * @returns {boolean} Whether to retry
   * @private
   */
  shouldRetry(error) {
    // Don't retry validation errors
    if (error.name === 'ValidationError') return false;
    if (error instanceof McpError && error.code === ErrorCode.InvalidRequest) return false;
    
    // Retry network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Retry timeout errors
    if (error.name === 'TimeoutError') return true;
    
    // Don't retry other errors by default
    return false;
  }

  /**
   * Get backoff delay for retries
   * @param {number} attempt - Retry attempt number
   * @returns {number} Delay in milliseconds
   * @private
   */
  getBackoffDelay(attempt) {
    // Exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Add timeout to a promise
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise with timeout
   * @private
   */
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('TimeoutError'));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Delay for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is critical
   * @param {Error} error - Error object
   * @returns {boolean} Whether error is critical
   * @private
   */
  isCriticalError(error) {
    const criticalErrors = [
      'ENOSPC', // No space left
      'EMFILE', // Too many open files
      'ENOMEM'  // Out of memory
    ];
    return criticalErrors.includes(error.code) || error.message.includes('heap out of memory');
  }

  /**
   * Sanitize arguments for safe logging
   * @param {Object} args - Arguments to sanitize
   * @returns {Object} Sanitized arguments
   * @private
   */
  sanitizeArgs(args) {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
    const sanitized = { ...args };
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Circuit breaker implementation
   */
  isCircuitOpen(context) {
    const breaker = this.circuitBreakers.get(context);
    if (!breaker) return false;
    
    if (breaker.state === 'open') {
      // Check if we should try half-open
      if (Date.now() - breaker.lastFailure > breaker.timeout) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }

  recordCircuitBreakerFailure(context) {
    const breaker = this.circuitBreakers.get(context) || {
      failures: 0,
      state: 'closed',
      lastFailure: 0,
      threshold: 5,
      timeout: 60000 // 1 minute
    };
    
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
      console.warn(`Circuit breaker opened for ${context} after ${breaker.failures} failures`);
    }
    
    this.circuitBreakers.set(context, breaker);
  }

  resetCircuitBreaker(context) {
    const breaker = this.circuitBreakers.get(context);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
  }

  /**
   * Setup global error handlers
   * @private
   */
  setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
      console.error('UNCAUGHT EXCEPTION:', error);
      if (this.healthMonitor) {
        this.healthMonitor.recordError(error, 'uncaughtException');
      }
      
      // Give time to log and cleanup, then exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('UNHANDLED REJECTION:', reason);
      if (this.healthMonitor) {
        this.healthMonitor.recordError(reason, 'unhandledRejection');
      }
    });

    process.on('warning', (warning) => {
      console.warn('NODE WARNING:', warning.message);
    });
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      total_errors: 0,
      by_context: {},
      circuit_breakers: {}
    };

    for (const [key, count] of this.errorCounts.entries()) {
      stats.total_errors += count;
      const [context, errorType] = key.split(':');
      
      if (!stats.by_context[context]) {
        stats.by_context[context] = {};
      }
      stats.by_context[context][errorType] = count;
    }

    for (const [context, breaker] of this.circuitBreakers.entries()) {
      stats.circuit_breakers[context] = {
        state: breaker.state,
        failures: breaker.failures,
        last_failure: breaker.lastFailure
      };
    }

    return stats;
  }
}