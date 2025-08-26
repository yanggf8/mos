/**
 * Core data types for the MCP Observability Server
 */

/**
 * Event types that can be monitored
 */
export const EVENT_TYPES = {
  // Task events
  TASK_STARTED: 'task_started',
  TASK_PROGRESS: 'task_progress', 
  TASK_COMPLETE: 'task_complete',
  TASK_FAILED: 'task_failed',
  
  // Tool events
  TOOL_PRE_CALL: 'tool_pre_call',
  TOOL_POST_CALL: 'tool_post_call',
  TOOL_ERROR: 'tool_error',
  
  // MCP events
  MCP_REQUEST: 'mcp_request',
  MCP_RESPONSE: 'mcp_response',
  MCP_ERROR: 'mcp_error',
  
  // Subagent events
  SUBAGENT_SPAWN: 'subagent_spawn',
  SUBAGENT_COMPLETE: 'subagent_complete',
  SUBAGENT_FAILED: 'subagent_failed'
};

/**
 * Event status values
 */
export const EVENT_STATUS = {
  STARTED: 'started',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout'
};

/**
 * Session status values
 */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Display icons for different event types
 */
export const EVENT_ICONS = {
  [EVENT_TYPES.TASK_STARTED]: '🔄',
  [EVENT_TYPES.TASK_COMPLETE]: '✅',
  [EVENT_TYPES.TASK_FAILED]: '❌',
  [EVENT_TYPES.TOOL_PRE_CALL]: '🔧',
  [EVENT_TYPES.TOOL_POST_CALL]: '🔧',
  [EVENT_TYPES.TOOL_ERROR]: '⚠️',
  [EVENT_TYPES.MCP_REQUEST]: '📡',
  [EVENT_TYPES.MCP_RESPONSE]: '📡',
  [EVENT_TYPES.MCP_ERROR]: '🔴',
  [EVENT_TYPES.SUBAGENT_SPAWN]: '🤖',
  [EVENT_TYPES.SUBAGENT_COMPLETE]: '🤖',
  [EVENT_TYPES.SUBAGENT_FAILED]: '🚫'
};

/**
 * Status colors for display
 */
export const STATUS_COLORS = {
  [EVENT_STATUS.STARTED]: 'blue',
  [EVENT_STATUS.RUNNING]: 'blue', 
  [EVENT_STATUS.SUCCESS]: 'green',
  [EVENT_STATUS.ERROR]: 'red',
  [EVENT_STATUS.TIMEOUT]: 'yellow'
};

/**
 * Create a new event object
 * @param {Object} params - Event parameters
 * @returns {Object} Event object
 */
export function createEvent({
  sessionId,
  eventType,
  status = EVENT_STATUS.STARTED,
  parentId = null,
  correlationId = null,
  duration = null,
  details = {},
  displayInfo = null
}) {
  const event = {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    event_type: eventType,
    status,
    duration_ms: duration,
    parent_id: parentId,
    correlation_id: correlationId,
    details,
    display_info: displayInfo || {
      icon: EVENT_ICONS[eventType] || '🔵',
      color: STATUS_COLORS[status] || 'default',
      indent_level: 0,
      should_collapse: false
    }
  };
  
  return event;
}

/**
 * Create a new session object
 * @param {string} sessionId - Session identifier
 * @param {string} rootTask - Root task description
 * @returns {Object} Session object
 */
export function createSession(sessionId, rootTask = 'Unknown Task') {
  return {
    id: sessionId,
    start_time: new Date().toISOString(),
    status: SESSION_STATUS.ACTIVE,
    root_task: rootTask,
    active_operations: [],
    metrics: {
      total_tools_used: 0,
      total_mcp_calls: 0,
      total_duration_ms: 0,
      error_count: 0
    }
  };
}

/**
 * Validate event object structure
 * @param {Object} event - Event to validate
 * @returns {boolean} True if valid
 */
export function validateEvent(event) {
  const required = ['timestamp', 'session_id', 'event_type', 'status'];
  return required.every(field => event.hasOwnProperty(field));
}

/**
 * Validate session object structure
 * @param {Object} session - Session to validate
 * @returns {boolean} True if valid
 */
export function validateSession(session) {
  const required = ['id', 'start_time', 'status', 'root_task'];
  return required.every(field => session.hasOwnProperty(field));
}