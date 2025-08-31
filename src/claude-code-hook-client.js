/**
 * Claude Code Hook Client
 * Provides easy interface for hooks to communicate with MCP Observability Server
 */

import { 
  formatHookEventMessage,
  formatHookActivityStream,
  formatHookSessionSummary,
  formatHookHealthStatus,
  formatHookPerformanceNotification,
  formatStatuslineDisplay
} from './claude-code-hook-display.js';

/**
 * Simple client for hooks to interact with the MCP Observability Server
 */
export class ClaudeCodeHookClient {
  constructor(mcpServerUrl = 'stdio://mcp-observability-server') {
    this.mcpServerUrl = mcpServerUrl;
    this.currentSessionId = process.env.CLAUDE_SESSION_ID || 'default-session';
  }

  /**
   * Get formatted activity stream for display in hooks
   * @returns {Promise<string>} Formatted activity stream
   */
  async getActivityStream() {
    try {
      // In a real implementation, this would call the MCP server
      // For now, return a formatted example
      const mockEvents = [
        {
          timestamp: new Date().toISOString(),
          event_type: 'tool_post_call',
          status: 'success',
          duration_ms: 245,
          details: { name: 'file_read' }
        },
        {
          timestamp: new Date().toISOString(),
          event_type: 'tool_pre_call',
          status: 'started',
          details: { name: 'edit_file' }
        }
      ];
      
      return formatHookActivityStream(mockEvents, 3);
    } catch (error) {
      return 'MCP Observability: Connection unavailable';
    }
  }

  /**
   * Check for performance alerts
   * @returns {Promise<Array>} Array of alert messages
   */
  async checkPerformanceAlerts() {
    try {
      // Mock implementation - would query MCP server for slow operations
      const alerts = [];
      
      // Example: check if any recent operations were slow
      const mockSlowEvent = {
        event_type: 'tool_post_call',
        status: 'success',
        duration_ms: 5200,
        details: { name: 'database_query' }
      };
      
      if (mockSlowEvent.duration_ms > 5000) {
        alerts.push(formatHookPerformanceNotification(mockSlowEvent, 5000));
      }
      
      return alerts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get current session summary
   * @returns {Promise<string>} Formatted session summary
   */
  async getSessionSummary() {
    try {
      // Mock session data - would come from MCP server
      const mockSession = {
        root_task: 'Implementing user authentication',
        status: 'completed',
        metrics: {
          total_duration_ms: 45000,
          total_tools_used: 12,
          error_count: 1
        }
      };
      
      return formatHookSessionSummary(mockSession);
    } catch (error) {
      return 'Session summary unavailable';
    }
  }

  /**
   * Get health status for statusline display
   * @returns {Promise<string>} Formatted health status
   */
  async getHealthStatus() {
    try {
      // Mock health data
      const mockHealth = {
        status: 'healthy',
        memory: { current_mb: 85 },
        sessions: { active: 1 },
        requests: { error_rate: 0.02 }
      };
      
      return formatHookHealthStatus(mockHealth);
    } catch (error) {
      return 'Health status unavailable';
    }
  }

  /**
   * Get data for statusline display
   * @returns {Promise<string>} Statusline formatted text
   */
  async getStatuslineData() {
    try {
      const mosData = {
        health: {
          status: 'healthy',
          memory: { current_mb: 85 }
        },
        activeEvents: [
          { event_type: 'tool_pre_call', details: { name: 'edit_file' } }
        ],
        currentSession: {
          metrics: { total_duration_ms: 12000 }
        }
      };
      
      return formatStatuslineDisplay(mosData);
    } catch (error) {
      return '🔴 Observability unavailable';
    }
  }

  /**
   * Log an event (called by Claude Code hooks)
   * @param {Object} eventData - Event data from Claude Code
   * @returns {Promise<void>}
   */
  async logEvent(eventData) {
    try {
      // In real implementation, this would send to MCP server
      const event = {
        session_id: this.currentSessionId,
        timestamp: new Date().toISOString(),
        ...eventData
      };
      
      // For now, just log to console
      const message = formatHookEventMessage(event);
      console.log(`[Observability] ${message}`);
    } catch (error) {
      // Silent fail - don't disrupt Claude Code operation
    }
  }

  /**
   * Send performance alert
   * @param {Object} alertData - Alert information
   * @returns {Promise<void>}
   */
  async sendPerformanceAlert(alertData) {
    try {
      const message = formatHookPerformanceNotification(alertData.event, alertData.threshold);
      
      // Try to send desktop notification (macOS example)
      if (process.platform === 'darwin') {
        const { spawn } = await import('child_process');
        spawn('osascript', [
          '-e', 
          `display notification "${message}" with title "Claude Code Performance"`
        ]);
      } else {
        // Fallback to console
        console.warn(`[Performance Alert] ${message}`);
      }
    } catch (error) {
      // Silent fail
    }
  }
}

// Export convenience functions for direct use in hooks
export async function getActivityStream() {
  const client = new ClaudeCodeHookClient();
  return await client.getActivityStream();
}

export async function checkPerformanceAlerts() {
  const client = new ClaudeCodeHookClient();
  return await client.checkPerformanceAlerts();
}

export async function getSessionSummary() {
  const client = new ClaudeCodeHookClient();
  return await client.getSessionSummary();
}

export async function getHealthStatus() {
  const client = new ClaudeCodeHookClient();
  return await client.getHealthStatus();
}

export async function getStatuslineData() {
  const client = new ClaudeCodeHookClient();
  return await client.getStatuslineData();
}

// Default export for ES modules
export default ClaudeCodeHookClient;