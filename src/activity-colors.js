/**
 * Color scheme for different activity types in MCP Observability Server
 * Supports both ANSI terminal colors and console styling
 */

// ANSI Color Codes for terminal output
export const ANSI_COLORS = {
  // Basic colors
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright foreground colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

// Activity Type Color Mapping
export const ACTIVITY_COLORS = {
  // Core tool operations - Blue spectrum
  TOOL: {
    color: ANSI_COLORS.brightBlue,
    icon: '🔧',
    description: 'Tool execution'
  },
  
  // Task management - Green spectrum  
  TASK: {
    color: ANSI_COLORS.brightGreen,
    icon: '📋',
    description: 'Task operations'
  },
  
  // MCP protocol - Cyan spectrum
  MCP: {
    color: ANSI_COLORS.brightCyan,
    icon: '🔗',
    description: 'MCP communication'
  },
  
  // Agent operations - Magenta spectrum
  AGENT: {
    color: ANSI_COLORS.brightMagenta,
    icon: '🤖',
    description: 'Agent/subagent activity'
  },
  
  // Performance monitoring - Yellow spectrum
  PERF: {
    color: ANSI_COLORS.brightYellow,
    icon: '⚡',
    description: 'Performance metrics'
  },
  
  // Error conditions - Red spectrum
  ERROR: {
    color: ANSI_COLORS.brightRed,
    icon: '❌',
    description: 'Error conditions'
  },
  
  // System health - Green spectrum
  HEALTH: {
    color: ANSI_COLORS.green,
    icon: '❤️',
    description: 'System health'
  },
  
  // Sessions - White spectrum
  SESSION: {
    color: ANSI_COLORS.brightWhite,
    icon: '📊',
    description: 'Session management'
  },
  
  // Events - Gray spectrum
  EVENT: {
    color: ANSI_COLORS.white,
    icon: '📋',
    description: 'Generic events'
  }
};

// Status-based colors for different states
export const STATUS_COLORS = {
  // Success states - Green
  success: ANSI_COLORS.brightGreen,
  completed: ANSI_COLORS.green,
  healthy: ANSI_COLORS.green,
  
  // In-progress states - Blue
  started: ANSI_COLORS.brightBlue,
  running: ANSI_COLORS.blue,
  active: ANSI_COLORS.cyan,
  
  // Warning states - Yellow
  warning: ANSI_COLORS.brightYellow,
  slow: ANSI_COLORS.yellow,
  degraded: ANSI_COLORS.yellow,
  
  // Error states - Red
  error: ANSI_COLORS.brightRed,
  failed: ANSI_COLORS.red,
  critical: ANSI_COLORS.bgRed + ANSI_COLORS.brightWhite,
  
  // Neutral states - White/Gray
  pending: ANSI_COLORS.white,
  idle: ANSI_COLORS.dim + ANSI_COLORS.white,
  unknown: ANSI_COLORS.dim + ANSI_COLORS.white
};

// Performance timing color scale
export const TIMING_COLORS = {
  // Very fast: <100ms - Green
  veryFast: ANSI_COLORS.green,
  
  // Fast: 100-500ms - Bright Green  
  fast: ANSI_COLORS.brightGreen,
  
  // Normal: 500ms-1s - Blue
  normal: ANSI_COLORS.blue,
  
  // Moderate: 1-2s - Cyan
  moderate: ANSI_COLORS.cyan,
  
  // Slow: 2-5s - Yellow
  slow: ANSI_COLORS.yellow,
  
  // Very slow: 5-10s - Bright Yellow
  verySlow: ANSI_COLORS.brightYellow,
  
  // Extremely slow: >10s - Red
  extremelySlow: ANSI_COLORS.red
};

/**
 * Get color for activity type
 * @param {string} activityType - Activity type (TOOL, TASK, MCP, etc.)
 * @returns {Object} Color configuration
 */
export function getActivityColor(activityType) {
  return ACTIVITY_COLORS[activityType] || ACTIVITY_COLORS.EVENT;
}

/**
 * Get color for status
 * @param {string} status - Status (success, error, warning, etc.)
 * @returns {string} ANSI color code
 */
export function getStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.unknown;
}

/**
 * Get color for timing based on duration
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} ANSI color code
 */
export function getTimingColor(durationMs) {
  if (durationMs < 100) return TIMING_COLORS.veryFast;
  if (durationMs < 500) return TIMING_COLORS.fast;
  if (durationMs < 1000) return TIMING_COLORS.normal;
  if (durationMs < 2000) return TIMING_COLORS.moderate;
  if (durationMs < 5000) return TIMING_COLORS.slow;
  if (durationMs < 10000) return TIMING_COLORS.verySlow;
  return TIMING_COLORS.extremelySlow;
}

/**
 * Format colored message for terminal display
 * @param {string} activityType - Activity type
 * @param {string} message - Message to display
 * @param {string} status - Status (optional)
 * @param {number} duration - Duration in ms (optional)
 * @returns {string} Colored terminal message
 */
export function formatColoredMessage(activityType, message, status = null, duration = null) {
  const activity = getActivityColor(activityType);
  const statusColor = status ? getStatusColor(status) : '';
  const timingColor = duration ? getTimingColor(duration) : '';
  
  let parts = [];
  
  // Colored activity type with icon
  parts.push(`${activity.color}${activity.icon} ${activityType}${ANSI_COLORS.reset}`);
  
  // Main message
  parts.push(message);
  
  // Colored status if provided
  if (status) {
    parts.push(`${statusColor}${status}${ANSI_COLORS.reset}`);
  }
  
  // Colored duration if provided
  if (duration) {
    const durationStr = formatDuration(duration);
    parts.push(`${timingColor}(${durationStr})${ANSI_COLORS.reset}`);
  }
  
  return parts.join(' ');
}

/**
 * Format colored timestamp
 * @param {Date|string} timestamp - Timestamp to format
 * @returns {string} Colored timestamp string
 */
export function formatColoredTimestamp(timestamp) {
  const time = new Date(timestamp).toLocaleTimeString();
  return `${ANSI_COLORS.dim}[${time}]${ANSI_COLORS.reset}`;
}

/**
 * Create colored activity log entry
 * @param {Object} event - Event object
 * @returns {string} Formatted colored log entry
 */
export function formatColoredLogEntry(event) {
  const timestamp = formatColoredTimestamp(event.timestamp);
  const operation = event.details?.name || event.event_type;
  
  let activityType, status, message;
  
  // Determine activity type and message based on event
  switch (event.event_type) {
    case 'tool_pre_call':
      activityType = 'TOOL';
      status = 'started';
      message = `${operation} - Starting execution`;
      break;
      
    case 'tool_post_call':
      activityType = 'TOOL';
      status = event.status;
      const statusIcon = event.status === 'success' ? '✓' : '✗';
      message = `${operation} - ${statusIcon} Completed`;
      break;
      
    case 'task_started':
      activityType = 'TASK';
      status = 'started';
      message = `${operation} - Started`;
      break;
      
    case 'task_complete':
      activityType = 'TASK';
      status = 'completed';
      message = `${operation} - ✓ Completed`;
      break;
      
    case 'task_failed':
      activityType = 'TASK';
      status = 'failed';
      message = `${operation} - ✗ Failed`;
      break;
      
    case 'mcp_request':
      activityType = 'MCP';
      status = 'started';
      message = `${operation} - Request sent`;
      break;
      
    case 'mcp_response':
      activityType = 'MCP';
      status = 'completed';
      message = `${operation} - Response received`;
      break;
      
    case 'mcp_error':
      activityType = 'MCP';
      status = 'error';
      message = `${operation} - ✗ Error`;
      break;
      
    case 'subagent_spawn':
      activityType = 'AGENT';
      status = 'started';
      message = `${operation} - Spawned`;
      break;
      
    case 'subagent_complete':
      activityType = 'AGENT';
      status = 'completed';
      message = `${operation} - ✓ Completed`;
      break;
      
    case 'subagent_failed':
      activityType = 'AGENT';
      status = 'failed';
      message = `${operation} - ✗ Failed`;
      break;
      
    default:
      activityType = 'EVENT';
      status = event.status;
      message = `${operation} - ${event.status}`;
  }
  
  const coloredMessage = formatColoredMessage(activityType, message, status, event.duration_ms);
  return `${timestamp} ${coloredMessage}`;
}

/**
 * Format duration string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Color scheme configuration for different contexts
 */
export const COLOR_SCHEMES = {
  // Terminal/Console output
  terminal: {
    name: 'Terminal',
    description: 'ANSI colors for terminal output',
    colors: ACTIVITY_COLORS,
    formatter: formatColoredMessage
  },
  
  // Claude Code hooks (plain text with emojis)
  claude_code: {
    name: 'Claude Code Hooks',
    description: 'Emoji-based indicators for Claude Code',
    colors: Object.fromEntries(
      Object.entries(ACTIVITY_COLORS).map(([key, value]) => [
        key, 
        { ...value, color: '', icon: value.icon }
      ])
    ),
    formatter: (type, msg, status, duration) => {
      const activity = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.EVENT;
      const durationStr = duration ? ` (${formatDuration(duration)})` : '';
      return `${activity.icon} ${type} ${msg}${durationStr}`;
    }
  },
  
  // Web/HTML output (could be used for future web interface)
  html: {
    name: 'HTML',
    description: 'CSS classes for web interface',
    colors: Object.fromEntries(
      Object.entries(ACTIVITY_COLORS).map(([key, value]) => [
        key,
        { 
          ...value, 
          color: `activity-${key.toLowerCase()}`,
          icon: value.icon 
        }
      ])
    )
  }
};

export default {
  ANSI_COLORS,
  ACTIVITY_COLORS,
  STATUS_COLORS,
  TIMING_COLORS,
  getActivityColor,
  getStatusColor,
  getTimingColor,
  formatColoredMessage,
  formatColoredTimestamp,
  formatColoredLogEntry,
  COLOR_SCHEMES
};