/**
 * Claude Code output style formatting
 */

import { EVENT_ICONS, STATUS_COLORS } from './types.js';

/**
 * Format duration in milliseconds to human readable string
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(durationMs) {
  if (!durationMs) return '';
  
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Generate tree-style indentation
 * @param {number} level - Indentation level
 * @param {boolean} isLast - Is this the last child
 * @param {boolean} hasChildren - Does this node have children
 * @returns {string} Tree characters
 */
export function getTreeChars(level, isLast = false, hasChildren = false) {
  if (level === 0) return '';
  
  const chars = [];
  for (let i = 0; i < level - 1; i++) {
    chars.push('│   ');
  }
  
  if (isLast) {
    chars.push(hasChildren ? '└─┬ ' : '└─ ');
  } else {
    chars.push(hasChildren ? '├─┬ ' : '├─ ');
  }
  
  return chars.join('');
}

/**
 * Format a single event for display
 * @param {Object} event - Event object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted line
 */
export function formatEventLine(event, options = {}) {
  const {
    showTimings = true,
    showIcons = true,
    indentLevel = 0,
    isLast = false,
    hasChildren = false
  } = options;
  
  const icon = showIcons ? event.display_info?.icon || EVENT_ICONS[event.event_type] || '🔵' : '';
  const tree = getTreeChars(indentLevel, isLast, hasChildren);
  const name = event.details?.name || event.event_type;
  const description = event.details?.description || '';
  const duration = showTimings && event.duration_ms ? ` (${formatDuration(event.duration_ms)})` : '';
  
  let status = '';
  if (event.status === 'running') {
    status = ' 🔄';
  } else if (event.status === 'success') {
    status = ' ✅';
  } else if (event.status === 'error') {
    status = ' ❌';
  } else if (event.status === 'timeout') {
    status = ' ⏰';
  }
  
  const parts = [tree, icon, name];
  if (description && description !== name) {
    parts.push(`→ ${description}`);
  }
  if (duration) {
    parts.push(duration);
  }
  if (status) {
    parts.push(status);
  }
  
  return parts.join(' ').trim();
}

/**
 * Format activity tree for display
 * @param {Object} activityTree - Tree structure
 * @param {Object} options - Formatting options
 * @returns {string[]} Array of formatted lines
 */
export function formatActivityTree(activityTree, options = {}) {
  const lines = [];
  
  function formatNode(node, level = 0, isLast = true, parentPrefix = '') {
    const hasChildren = node.children && node.children.length > 0;
    
    // Format current node
    const line = formatEventLine(node, {
      ...options,
      indentLevel: level,
      isLast,
      hasChildren
    });
    lines.push(line);
    
    // Format children
    if (hasChildren) {
      node.children.forEach((child, index) => {
        const childIsLast = index === node.children.length - 1;
        formatNode(child, level + 1, childIsLast);
      });
    }
  }
  
  if (activityTree.root_task) {
    formatNode(activityTree.root_task, 0, true);
  }
  
  return lines;
}

/**
 * Format session summary
 * @param {Object} session - Session object  
 * @returns {string} Formatted summary
 */
export function formatSessionSummary(session) {
  const duration = session.metrics?.total_duration_ms ? 
    ` (${formatDuration(session.metrics.total_duration_ms)})` : '';
    
  const parts = [
    `📋 Session: ${session.root_task}`,
    `   Status: ${session.status}${duration}`,
    `   Tools: ${session.metrics?.total_tools_used || 0}`,
    `   MCP Calls: ${session.metrics?.total_mcp_calls || 0}`,
    `   Errors: ${session.metrics?.error_count || 0}`
  ];
  
  return parts.join('\n');
}

/**
 * Format slow operation alert
 * @param {Object} event - Slow event
 * @param {number} threshold - Threshold in ms
 * @returns {string} Alert message
 */
export function formatSlowOperationAlert(event, threshold) {
  const name = event.details?.name || event.event_type;
  const duration = formatDuration(event.duration_ms);
  const thresholdStr = formatDuration(threshold);
  
  return `⚠️  Slow operation detected: ${name} (${duration} > ${thresholdStr} threshold)`;
}

/**
 * Format error details
 * @param {Object} event - Error event
 * @returns {string} Error message
 */
export function formatError(event) {
  const name = event.details?.name || event.event_type;
  const error = event.details?.error_message || 'Unknown error';
  
  return `❌ ${name}: ${error}`;
}