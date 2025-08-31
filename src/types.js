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
 * Validate event object structure with comprehensive nested validation
 * @param {Object} event - Event to validate
 * @returns {boolean} True if valid
 */
export function validateEvent(event) {
  // Check for null/undefined
  if (!event || typeof event !== 'object') {
    return false;
  }

  // Required fields validation
  const required = ['timestamp', 'session_id', 'event_type', 'status'];
  if (!required.every(field => event.hasOwnProperty(field))) {
    return false;
  }

  // Type validation for core fields
  if (typeof event.session_id !== 'string' || event.session_id.length === 0) {
    return false;
  }

  if (typeof event.event_type !== 'string' || !Object.values(EVENT_TYPES).includes(event.event_type)) {
    return false;
  }

  if (typeof event.status !== 'string' || !Object.values(EVENT_STATUS).includes(event.status)) {
    return false;
  }

  // Timestamp validation
  if (typeof event.timestamp !== 'string' || isNaN(Date.parse(event.timestamp))) {
    return false;
  }

  // Optional field validation
  if (event.parent_id !== null && event.parent_id !== undefined) {
    if (typeof event.parent_id !== 'string' || event.parent_id.length === 0) {
      return false;
    }
  }

  if (event.correlation_id !== null && event.correlation_id !== undefined) {
    if (typeof event.correlation_id !== 'string' || event.correlation_id.length === 0) {
      return false;
    }
  }

  if (event.duration_ms !== null && event.duration_ms !== undefined) {
    if (typeof event.duration_ms !== 'number' || event.duration_ms < 0) {
      return false;
    }
  }

  // Details object validation with depth limit
  if (event.details !== null && event.details !== undefined) {
    if (!validateDetailsObject(event.details, 0, 3)) {
      return false;
    }
  }

  // Display info validation
  if (event.display_info !== null && event.display_info !== undefined) {
    if (!validateDisplayInfo(event.display_info)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate details object with depth limit to prevent deep nesting attacks
 * @param {*} obj - Object to validate
 * @param {number} currentDepth - Current nesting depth
 * @param {number} maxDepth - Maximum allowed depth
 * @returns {boolean} True if valid
 */
function validateDetailsObject(obj, currentDepth = 0, maxDepth = 3) {
  if (currentDepth > maxDepth) {
    return false;
  }

  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean';
  }

  if (Array.isArray(obj)) {
    // Limit array size to prevent memory attacks
    if (obj.length > 100) {
      return false;
    }
    return obj.every(item => validateDetailsObject(item, currentDepth + 1, maxDepth));
  }

  // Limit object property count
  const keys = Object.keys(obj);
  if (keys.length > 50) {
    return false;
  }

  // Validate each property
  return keys.every(key => {
    // Validate key
    if (typeof key !== 'string' || key.length > 100) {
      return false;
    }
    // Validate value recursively
    return validateDetailsObject(obj[key], currentDepth + 1, maxDepth);
  });
}

/**
 * Validate display info object
 * @param {Object} displayInfo - Display info to validate
 * @returns {boolean} True if valid
 */
function validateDisplayInfo(displayInfo) {
  if (!displayInfo || typeof displayInfo !== 'object') {
    return false;
  }

  const allowedFields = ['name', 'description', 'icon', 'color'];
  const keys = Object.keys(displayInfo);

  // Only allow expected fields
  if (!keys.every(key => allowedFields.includes(key))) {
    return false;
  }

  // Validate field types and lengths
  if (displayInfo.name && (typeof displayInfo.name !== 'string' || displayInfo.name.length > 200)) {
    return false;
  }

  if (displayInfo.description && (typeof displayInfo.description !== 'string' || displayInfo.description.length > 500)) {
    return false;
  }

  if (displayInfo.icon && (typeof displayInfo.icon !== 'string' || displayInfo.icon.length > 10)) {
    return false;
  }

  if (displayInfo.color && (typeof displayInfo.color !== 'string' || displayInfo.color.length > 20)) {
    return false;
  }

  return true;
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