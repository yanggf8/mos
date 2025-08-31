/**
 * MCP Output Style Injection
 * Dynamically injects monitoring behavior into Claude Code responses when MOS is active
 */

/**
 * MCP Output Style Injector - provides dynamic monitoring behavior
 */
export class MCPOutputInjector {
  constructor(sessionManager, healthMonitor) {
    this.sessionManager = sessionManager;
    this.healthMonitor = healthMonitor;
    this.isActive = true;
  }

  /**
   * Inject monitoring context into MCP tool responses
   */
  injectMonitoringContext(toolResponse, toolName, sessionId, duration) {
    if (!this.isActive) return toolResponse;

    const monitoringInfo = this.generateMonitoringInfo(toolName, sessionId, duration);
    
    // Add monitoring context to the response
    if (toolResponse.content && Array.isArray(toolResponse.content)) {
      // Prepend monitoring info to existing content
      toolResponse.content.unshift({
        type: 'text',
        text: monitoringInfo
      });
    }

    return toolResponse;
  }

  /**
   * Generate monitoring information for display
   */
  generateMonitoringInfo(toolName, sessionId, duration) {
    const performanceIcon = this.getPerformanceIcon(duration);
    const sessionStats = this.getSessionStats(sessionId);
    
    const lines = [
      `🔧 MCP Tool: ${toolName} (${duration}ms) ${performanceIcon}`,
      `📊 MOS Status: Active monitoring`,
      sessionStats
    ];

    return lines.filter(Boolean).join('\n') + '\n';
  }

  /**
   * Get performance indicator based on duration
   */
  getPerformanceIcon(duration) {
    if (duration < 500) return '✅';      // Fast
    if (duration < 2000) return '🟡';    // Moderate  
    if (duration < 5000) return '🟠';    // Slow
    return '🔴';                         // Very slow
  }

  /**
   * Get current session statistics
   */
  getSessionStats(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) return '📈 Session: New session started';

      const events = this.sessionManager.getSessionEvents(sessionId);
      const successCount = events.filter(e => e.status === 'success').length;
      const totalCount = events.length;
      const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
      
      const avgDuration = events
        .filter(e => e.duration_ms)
        .reduce((sum, e, _, arr) => sum + e.duration_ms / arr.length, 0);

      return `📈 Session: ${totalCount} operations, ${successRate}% success rate` + 
             (avgDuration > 0 ? `, avg ${Math.round(avgDuration)}ms` : '');
    } catch (error) {
      return '📈 Session: Monitoring active';
    }
  }

  /**
   * Generate system health summary for inclusion in responses
   */
  getSystemHealthSummary() {
    if (!this.isActive) return '';

    try {
      const health = this.healthMonitor.getHealthStatus();
      const memoryMB = Math.round(health.memory.current_mb);
      const status = health.status;
      
      const healthIcon = status === 'healthy' ? '🟢' : 
                        status === 'warning' ? '🟡' : '🔴';
                        
      return `🖥️ MOS Health: ${healthIcon} ${status}, ${memoryMB}MB memory`;
    } catch (error) {
      return '🖥️ MOS Health: Active';
    }
  }

  /**
   * Create a comprehensive activity summary for tool responses
   */
  createActivitySummary(toolName, sessionId, duration, additionalContext = {}) {
    if (!this.isActive) return '';

    const lines = [
      `🎯 Current Operation: ${additionalContext.description || `Executing ${toolName}`}`,
      '',
      this.generateMonitoringInfo(toolName, sessionId, duration).trim(),
      this.getSystemHealthSummary(),
      ''
    ];

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Activate/deactivate monitoring injection
   */
  setActive(active) {
    this.isActive = active;
    console.log(`📡 MCP monitoring injection ${active ? 'activated' : 'deactivated'}`);
  }

  /**
   * Check if monitoring is currently active
   */
  isMonitoringActive() {
    return this.isActive;
  }
}

/**
 * Helper function to wrap MCP tool handlers with monitoring injection
 */
export function wrapToolHandlerWithMonitoring(handler, injector, toolName) {
  return async function(args, sessionId) {
    const startTime = performance.now();
    
    try {
      // Execute the original handler
      const result = await handler.call(this, args);
      
      // Calculate duration and inject monitoring context
      const duration = Math.round(performance.now() - startTime);
      
      // Add monitoring context to the response
      return injector.injectMonitoringContext(result, toolName, sessionId || 'default', duration);
      
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      // Still inject monitoring context for errors
      const errorResult = {
        content: [{
          type: 'text',
          text: `Error in ${toolName}: ${error.message}`
        }]
      };
      
      return injector.injectMonitoringContext(errorResult, toolName, sessionId || 'default', duration);
    }
  };
}

export default MCPOutputInjector;