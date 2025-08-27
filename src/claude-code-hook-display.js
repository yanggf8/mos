/**
 * Claude Code Hook Display Integration
 * Uses Claude Code's hook system to display observability information natively
 * 
 * Based on the hooks guide, Claude Code hooks can:
 * - Display messages through shell commands
 * - Log to files and console
 * - Send desktop notifications
 * - Format markdown output
 * - Provide real-time feedback
 */

import { formatDuration } from './formatter.js';

/**
 * Format observability data for Claude Code hook display
 * Matches the patterns shown in the hooks guide examples
 */

/**
 * Format event for hook display with activity type after timestamp
 * @param {Object} event - Event to display
 * @returns {string} Hook-formatted message
 */
export function formatHookEventMessage(event) {
  const operation = event.details?.name || event.event_type;
  const duration = event.duration_ms ? ` (${formatDuration(event.duration_ms)})` : '';
  
  // Format: [timestamp] ACTIVITY_TYPE operation - description
  switch (event.event_type) {
    case 'tool_pre_call':
      return `TOOL ${operation} - Starting execution`;
      
    case 'tool_post_call':
      const status = event.status === 'success' ? '✓' : '✗';
      return `TOOL ${operation}${duration} - ${status} Completed`;
      
    case 'task_started':
      return `TASK ${operation} - Started`;
      
    case 'task_complete':
      return `TASK ${operation}${duration} - ✓ Completed`;
      
    case 'task_failed':
      return `TASK ${operation}${duration} - ✗ Failed`;
      
    case 'mcp_request':
      return `MCP ${operation} - Request sent`;
      
    case 'mcp_response':
      return `MCP ${operation}${duration} - Response received`;
      
    case 'mcp_error':
      return `MCP ${operation}${duration} - ✗ Error`;
      
    case 'subagent_spawn':
      return `AGENT ${operation} - Spawned`;
      
    case 'subagent_complete':
      return `AGENT ${operation}${duration} - ✓ Completed`;
      
    case 'subagent_failed':
      return `AGENT ${operation}${duration} - ✗ Failed`;
      
    default:
      return `EVENT ${operation}${duration} - ${event.status}`;
  }
}

/**
 * Format performance alert for desktop notification (like the hooks guide examples)
 * @param {Object} event - Slow event
 * @param {number} threshold - Threshold in ms
 * @returns {string} Notification message
 */
export function formatHookPerformanceNotification(event, threshold) {
  const operation = event.details?.name || event.event_type;
  const duration = formatDuration(event.duration_ms);
  const thresholdStr = formatDuration(threshold);
  
  // Format like "Claude Code - Awaiting your input" from hooks guide
  return `Claude Code Observability - Slow operation: ${operation} (${duration} > ${thresholdStr})`;
}

/**
 * Format session summary for hook display (markdown formatting like hooks guide)
 * @param {Object} session - Session object
 * @returns {string} Formatted session summary
 */
export function formatHookSessionSummary(session) {
  const duration = session.metrics?.total_duration_ms ? 
    formatDuration(session.metrics.total_duration_ms) : 'ongoing';
  const toolCount = session.metrics?.total_tools_used || 0;
  const errorCount = session.metrics?.error_count || 0;
  const status = session.status === 'completed' ? '✓' : session.status === 'failed' ? '✗' : '🔄';
  
  // Markdown formatting like the hooks guide examples
  return `${status} **${session.root_task}** (${duration}) - ${toolCount} tools used${errorCount > 0 ? `, ${errorCount} errors` : ''}`;
}

/**
 * Format activity stream for console output (similar to command logging)
 * @param {Array} recentEvents - Recent events to display
 * @param {number} maxEvents - Maximum events to show
 * @returns {string} Console output
 */
export function formatHookActivityStream(recentEvents, maxEvents = 5) {
  const events = recentEvents.slice(-maxEvents);
  const lines = [];
  
  lines.push('Claude Code Activity Stream:');
  
  for (const event of events) {
    const message = formatHookEventMessage(event);
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    lines.push(`[${timestamp}] ${message}`);
  }
  
  return lines.join('\n');
}

/**
 * Format health status for hook display
 * @param {Object} health - Health status
 * @returns {string} Health status message
 */
export function formatHookHealthStatus(health) {
  const statusIcon = health.status === 'healthy' ? '✓' : 
                    health.status === 'warning' ? '⚠️' : '✗';
  
  const memory = health.memory.current_mb;
  const sessions = health.sessions.active;
  const errorRate = (health.requests.error_rate * 100).toFixed(1);
  
  return `${statusIcon} MCP Observability: ${memory}MB, ${sessions} sessions, ${errorRate}% errors`;
}

/**
 * Generate hook configuration for Claude Code settings
 * @returns {Object} Hook configuration object
 */
export function generateClaudeCodeHookConfig() {
  return {
    "observability_activity": {
      "command": ["node", "-e", `
        // Call our MCP server to get activity stream
        import('./src/claude-code-hook-client.js').then(client => {
          client.getActivityStream().then(console.log);
        }).catch(() => console.log('MCP Observability: Not available'));
      `],
      "matchers": [
        {
          "events": ["PreToolUse", "PostToolUse"],
          "description": "Log tool activity to observability server"
        }
      ]
    },
    "observability_performance": {
      "command": ["node", "-e", `
        // Check for performance alerts
        import('./src/claude-code-hook-client.js').then(client => {
          client.checkPerformanceAlerts().then(alerts => {
            if (alerts.length > 0) {
              alerts.forEach(alert => console.error(alert));
            }
          });
        }).catch(() => {});
      `],
      "matchers": [
        {
          "events": ["PostToolUse"],
          "description": "Monitor for slow operations"
        }
      ]
    },
    "observability_session": {
      "command": ["node", "-e", `
        // Display session summary on completion
        import('./src/claude-code-hook-client.js').then(client => {
          client.getSessionSummary().then(console.log);
        }).catch(() => {});
      `],
      "matchers": [
        {
          "events": ["Notification"],
          "conditions": [
            {
              "field": "notification_type", 
              "operator": "equals",
              "value": "session_complete"
            }
          ]
        }
      ]
    }
  };
}

/**
 * Create shell commands for direct hook integration
 * @returns {Object} Shell command configurations
 */
export function createHookShellCommands() {
  return {
    // Simple activity logging (like the hooks guide bash example)
    activity_logger: {
      command: 'echo "$(date): $TOOL_NAME - $TOOL_DESCRIPTION" >> ~/.claude/observability.log',
      description: 'Log tool activity to file'
    },
    
    // Performance alert notification
    performance_alert: {
      command: `
        if [ $TOOL_DURATION -gt 5000 ]; then
          osascript -e 'display notification "Slow operation: $TOOL_NAME ($TOOL_DURATION ms)" with title "Claude Code Performance"'
        fi
      `,
      description: 'Alert on slow operations'
    },
    
    // Session status display
    session_status: {
      command: `
        curl -s -X POST http://localhost:3000/mcp \\
          -H "Content-Type: application/json" \\
          -d '{"method": "get_health_status", "params": {}}' | \\
          jq -r '.result.content[0].text' 2>/dev/null || \\
          echo "MCP Observability: Not available"
      `,
      description: 'Display current session status'
    }
  };
}

/**
 * Format for Claude Code statusline integration
 * @param {Object} observabilityData - Current observability data
 * @returns {string} Statusline formatted text
 */
export function formatStatuslineDisplay(observabilityData) {
  const { health, activeEvents, currentSession } = observabilityData;
  
  const parts = [];
  
  // Health indicator
  const healthIcon = health?.status === 'healthy' ? '🟢' : 
                    health?.status === 'warning' ? '🟡' : '🔴';
  parts.push(healthIcon);
  
  // Active operations
  if (activeEvents && activeEvents.length > 0) {
    parts.push(`${activeEvents.length} ops`);
  }
  
  // Memory usage
  if (health?.memory?.current_mb) {
    parts.push(`${health.memory.current_mb}MB`);
  }
  
  // Session duration
  if (currentSession?.metrics?.total_duration_ms) {
    const duration = formatDuration(currentSession.metrics.total_duration_ms);
    parts.push(duration);
  }
  
  return parts.join(' | ');
}