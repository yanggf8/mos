/**
 * Claude Code Native Output Style Formatter
 * Based on Claude Code's statusline system and terminal-based interface patterns
 * 
 * Key characteristics observed from Claude Code documentation:
 * - Uses statusline for contextual information
 * - Terminal-based interface with keyboard navigation
 * - JSON-structured data for configuration
 * - Focus on session metrics and contextual display
 * - Supports themes and customizable appearance
 */

import { formatDuration } from './formatter.js';

/**
 * Claude Code appears to use clean, minimal formatting with focus on:
 * - Contextual status information
 * - Session metrics (cost, duration, changes)
 * - Git-aware displays
 * - Model and workspace context
 */

/**
 * Format task progress in Claude Code style
 * @param {Object} session - Session object
 * @param {Array} events - Recent events
 * @returns {string} Claude Code formatted output
 */
export function formatClaudeCodeTaskProgress(session, events = []) {
  const lines = [];
  
  // Main task header (Claude Code style)
  const rootTask = session.root_task;
  const status = session.status === 'active' ? '🔄' : session.status === 'completed' ? '✅' : '❌';
  const duration = session.metrics?.total_duration_ms ? 
    ` (${formatDuration(session.metrics.total_duration_ms)})` : '';
  
  lines.push(`${status} **${rootTask}**${duration}`);
  lines.push(''); // Empty line for spacing
  
  // Group events by type and format as Claude Code does
  const groupedEvents = groupEventsByContext(events);
  
  for (const [context, contextEvents] of groupedEvents) {
    const contextLines = formatEventContext(context, contextEvents);
    lines.push(...contextLines);
  }
  
  return lines.join('\n');
}

/**
 * Format tool execution in Claude Code's inline style
 * @param {Object} event - Tool event
 * @returns {string} Inline formatted tool call
 */
export function formatClaudeCodeToolCall(event) {
  const toolName = event.details?.name || event.event_type.replace('tool_', '');
  const duration = event.duration_ms ? ` (${formatDuration(event.duration_ms)})` : '';
  const status = getClaudeCodeStatusIcon(event.status);
  
  // Claude Code often shows tool calls inline with the response
  if (event.status === 'started' || event.status === 'running') {
    return `*Using ${toolName}...*`;
  } else {
    return `*${toolName}${duration}* ${status}`;
  }
}

/**
 * Format progress indicator matching Claude Code's style
 * @param {Array} activeEvents - Currently running events
 * @returns {string} Progress indicator
 */
export function formatClaudeCodeProgressIndicator(activeEvents) {
  if (activeEvents.length === 0) return '';
  
  const lines = [];
  
  // Claude Code shows a compact progress view
  if (activeEvents.length === 1) {
    const event = activeEvents[0];
    const operation = event.details?.name || event.event_type;
    lines.push(`🔄 ${operation}...`);
  } else {
    lines.push(`🔄 Working on ${activeEvents.length} operations...`);
    activeEvents.slice(0, 3).forEach(event => {
      const operation = event.details?.name || event.event_type;
      lines.push(`  • ${operation}`);
    });
    if (activeEvents.length > 3) {
      lines.push(`  • ... and ${activeEvents.length - 3} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format session summary as Claude Code would show it
 * @param {Object} session - Session object
 * @returns {string} Session summary
 */
export function formatClaudeCodeSessionSummary(session) {
  const duration = session.metrics?.total_duration_ms ? 
    formatDuration(session.metrics.total_duration_ms) : 'ongoing';
  const toolCount = session.metrics?.total_tools_used || 0;
  const errorCount = session.metrics?.error_count || 0;
  
  const lines = [];
  lines.push(`**Session Summary**`);
  lines.push(`• Duration: ${duration}`);
  lines.push(`• Tools used: ${toolCount}`);
  if (errorCount > 0) {
    lines.push(`• Errors encountered: ${errorCount}`);
  }
  
  return lines.join('\n');
}

/**
 * Format error message in Claude Code style
 * @param {Object} event - Error event
 * @returns {string} Formatted error
 */
export function formatClaudeCodeError(event) {
  const operation = event.details?.name || event.event_type;
  const error = event.details?.error_message || 'An error occurred';
  
  return `❌ **Error in ${operation}**: ${error}`;
}

/**
 * Format performance alert matching Claude Code's notification style
 * @param {Object} event - Slow event
 * @param {number} threshold - Threshold in ms
 * @returns {string} Performance alert
 */
export function formatClaudeCodePerformanceAlert(event, threshold) {
  const operation = event.details?.name || event.event_type;
  const duration = formatDuration(event.duration_ms);
  const thresholdStr = formatDuration(threshold);
  
  return `⚠️ **Performance Notice**: ${operation} took ${duration} (threshold: ${thresholdStr})`;
}

/**
 * Format activity stream for real-time display
 * @param {Array} events - Stream of events
 * @param {Object} options - Display options
 * @returns {string} Formatted stream
 */
export function formatClaudeCodeActivityStream(events, options = {}) {
  const {
    showTimestamps = false,
    groupSimilar = true,
    maxLines = 10
  } = options;
  
  const lines = [];
  const recentEvents = events.slice(-maxLines);
  
  if (groupSimilar) {
    const grouped = groupConsecutiveEvents(recentEvents);
    for (const group of grouped) {
      lines.push(formatEventGroup(group, showTimestamps));
    }
  } else {
    for (const event of recentEvents) {
      lines.push(formatSingleEvent(event, showTimestamps));
    }
  }
  
  return lines.join('\n');
}

/**
 * Format health status in Claude Code's diagnostic style
 * @param {Object} health - Health status object
 * @returns {string} Formatted health status
 */
export function formatClaudeCodeHealthStatus(health) {
  const lines = [];
  
  // Overall status
  const statusIcon = health.status === 'healthy' ? '🟢' : 
                    health.status === 'warning' ? '🟡' : '🔴';
  lines.push(`${statusIcon} **Server Status**: ${health.status.toUpperCase()}`);
  lines.push('');
  
  // Key metrics
  lines.push(`**Performance Metrics**`);
  lines.push(`• Memory: ${health.memory.current_mb}MB`);
  lines.push(`• Active sessions: ${health.sessions.active}`);
  lines.push(`• Average response time: ${health.requests.avg_response_time_ms}ms`);
  lines.push(`• Error rate: ${(health.requests.error_rate * 100).toFixed(1)}%`);
  
  if (health.status !== 'healthy') {
    lines.push('');
    lines.push(`**Alerts**`);
    // Add specific health issues
    if (health.memory.current_mb > 400) {
      lines.push(`⚠️ High memory usage (${health.memory.current_mb}MB)`);
    }
    if (health.requests.error_rate > 0.05) {
      lines.push(`⚠️ Elevated error rate (${(health.requests.error_rate * 100).toFixed(1)}%)`);
    }
  }
  
  return lines.join('\n');
}

// Helper functions

function groupEventsByContext(events) {
  const grouped = new Map();
  
  for (const event of events) {
    let context = 'general';
    
    if (event.event_type.startsWith('task_')) {
      context = 'tasks';
    } else if (event.event_type.startsWith('tool_')) {
      context = 'tools';
    } else if (event.event_type.startsWith('mcp_')) {
      context = 'mcp';
    } else if (event.event_type.startsWith('subagent_')) {
      context = 'subagents';
    }
    
    if (!grouped.has(context)) {
      grouped.set(context, []);
    }
    grouped.get(context).push(event);
  }
  
  return grouped;
}

function formatEventContext(context, events) {
  const lines = [];
  const contextLabels = {
    'tasks': '📋 Tasks',
    'tools': '🔧 Tools',
    'mcp': '📡 MCP Calls', 
    'subagents': '🤖 Subagents',
    'general': '📊 Activity'
  };
  
  lines.push(`**${contextLabels[context] || context}**`);
  
  for (const event of events.slice(-5)) { // Show last 5 events per context
    const formatted = formatSingleEvent(event, false);
    lines.push(`  ${formatted}`);
  }
  
  if (events.length > 5) {
    lines.push(`  *... and ${events.length - 5} more*`);
  }
  
  lines.push(''); // Empty line between contexts
  return lines;
}

function formatSingleEvent(event, showTimestamp) {
  const operation = event.details?.name || event.event_type;
  const duration = event.duration_ms ? ` (${formatDuration(event.duration_ms)})` : '';
  const status = getClaudeCodeStatusIcon(event.status);
  const timestamp = showTimestamp ? `[${new Date(event.timestamp).toLocaleTimeString()}] ` : '';
  
  return `${timestamp}${operation}${duration} ${status}`;
}

function formatEventGroup(events, showTimestamp) {
  if (events.length === 1) {
    return formatSingleEvent(events[0], showTimestamp);
  }
  
  const operation = events[0].details?.name || events[0].event_type;
  const successCount = events.filter(e => e.status === 'success').length;
  const totalCount = events.length;
  
  return `${operation} (${successCount}/${totalCount} successful)`;
}

function groupConsecutiveEvents(events) {
  const groups = [];
  let currentGroup = [];
  let currentOperation = null;
  
  for (const event of events) {
    const operation = event.details?.name || event.event_type;
    
    if (operation === currentOperation && currentGroup.length < 5) {
      currentGroup.push(event);
    } else {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [event];
      currentOperation = operation;
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

function getClaudeCodeStatusIcon(status) {
  const icons = {
    'started': '🔄',
    'running': '🔄', 
    'success': '✅',
    'error': '❌',
    'timeout': '⏰'
  };
  return icons[status] || '';
}

/**
 * Format content for MCP method responses to look like Claude Code output
 * @param {string} type - Type of content (progress, summary, error, etc.)
 * @param {Object} data - Data to format
 * @returns {Object} MCP content response
 */
export function formatMCPResponse(type, data) {
  let formattedText = '';
  
  switch (type) {
    case 'task_progress':
      formattedText = formatClaudeCodeTaskProgress(data.session, data.events);
      break;
    case 'session_summary':
      formattedText = formatClaudeCodeSessionSummary(data);
      break;
    case 'health_status':
      formattedText = formatClaudeCodeHealthStatus(data);
      break;
    case 'activity_stream':
      formattedText = formatClaudeCodeActivityStream(data.events, data.options);
      break;
    case 'error':
      formattedText = formatClaudeCodeError(data);
      break;
    case 'performance_alert':
      formattedText = formatClaudeCodePerformanceAlert(data.event, data.threshold);
      break;
    default:
      formattedText = JSON.stringify(data, null, 2);
  }
  
  return {
    content: [
      {
        type: 'text',
        text: formattedText
      }
    ]
  };
}