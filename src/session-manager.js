/**
 * Session Management System
 * Handles session lifecycle, event storage, and activity tree building
 */

import { v4 as uuidv4 } from 'uuid';
import { createSession, validateSession, EVENT_TYPES, SESSION_STATUS } from './types.js';

export class SessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.sessionEvents = new Map();
    this.maxEventsPerSession = options.maxEventsPerSession || 1000;
    this.sessionTimeoutMs = options.sessionTimeoutMs || 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = null;
    
    // Start cleanup timer (but not in test environment)
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupTimer();
    }
  }

  /**
   * Create a new session
   * @param {string} sessionId - Session identifier
   * @param {string} rootTask - Root task description
   * @returns {Object} Created session
   */
  createSession(sessionId, rootTask = 'Unknown Task') {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const session = createSession(sessionId, rootTask);
    this.sessions.set(sessionId, session);
    this.sessionEvents.set(sessionId, []);

    console.error(`Created session: ${sessionId} - ${rootTask}`);
    return session;
  }

  /**
   * Get existing session
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session object or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update session status
   * @param {string} sessionId - Session identifier
   * @param {string} status - New status
   */
  updateSessionStatus(sessionId, status) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      if (status === SESSION_STATUS.COMPLETED || status === SESSION_STATUS.FAILED) {
        session.end_time = new Date().toISOString();
        
        // Calculate total duration
        const startTime = new Date(session.start_time);
        const endTime = new Date(session.end_time);
        session.metrics.total_duration_ms = endTime - startTime;
      }
    }
  }

  /**
   * Add event to session
   * @param {string} sessionId - Session identifier
   * @param {Object} event - Event object
   */
  addEvent(sessionId, event) {
    // Ensure session exists
    if (!this.sessions.has(sessionId)) {
      this.createSession(sessionId, event.details?.task_name || 'Unknown Task');
    }

    const events = this.sessionEvents.get(sessionId);
    if (!events) return;

    // Add event with unique ID
    const eventWithId = {
      ...event,
      id: uuidv4(),
      timestamp: event.timestamp || new Date().toISOString()
    };

    events.push(eventWithId);

    // Limit events per session (circular buffer)
    if (events.length > this.maxEventsPerSession) {
      events.shift();
    }

    // Update session metrics and active operations
    this.updateSessionFromEvent(sessionId, eventWithId);

    return eventWithId;
  }

  /**
   * Get events for a session
   * @param {string} sessionId - Session identifier
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered events
   */
  getSessionEvents(sessionId, filter = {}) {
    const events = this.sessionEvents.get(sessionId) || [];
    
    let filtered = events;
    
    if (filter.event_types) {
      filtered = filtered.filter(e => filter.event_types.includes(e.event_type));
    }
    
    if (filter.status) {
      filtered = filtered.filter(e => e.status === filter.status);
    }
    
    if (filter.since) {
      const sinceDate = new Date(filter.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= sinceDate);
    }
    
    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }
    
    return filtered;
  }

  /**
   * Build hierarchical activity tree from events
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Tree building options
   * @returns {Object} Activity tree
   */
  buildActivityTree(sessionId, options = {}) {
    const {
      include_completed = true,
      max_depth = 5
    } = options;

    const events = this.getSessionEvents(sessionId);
    const session = this.getSession(sessionId);

    if (!session || events.length === 0) {
      return { root_task: null };
    }

    // Build tree structure
    const nodeMap = new Map();
    const rootNodes = [];

    // First pass: create nodes
    for (const event of events) {
      if (!include_completed && event.status === 'success') {
        continue;
      }

      const node = {
        id: event.id,
        event_type: event.event_type,
        name: event.details?.name || event.event_type,
        description: event.details?.description || '',
        status: event.status,
        timestamp: event.timestamp,
        duration_ms: event.duration_ms,
        parent_id: event.parent_id,
        correlation_id: event.correlation_id,
        details: event.details,
        display_info: event.display_info,
        children: []
      };

      nodeMap.set(event.id, node);

      if (!event.parent_id) {
        rootNodes.push(node);
      }
    }

    // Second pass: build parent-child relationships
    for (const node of nodeMap.values()) {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id);
        parent.children.push(node);
      }
    }

    // Find or create root task node
    let rootTask = null;
    if (rootNodes.length > 0) {
      // Use first task event as root, or create synthetic root
      const taskEvents = rootNodes.filter(n => n.event_type.startsWith('task_'));
      if (taskEvents.length > 0) {
        rootTask = taskEvents[0];
      } else {
        rootTask = {
          id: 'root',
          event_type: 'task_started',
          name: session.root_task,
          description: session.root_task,
          status: session.status,
          timestamp: session.start_time,
          duration_ms: session.metrics?.total_duration_ms,
          children: rootNodes
        };
      }
    }

    // Limit tree depth
    this.limitTreeDepth(rootTask, max_depth);

    return {
      session_id: sessionId,
      root_task: rootTask
    };
  }

  /**
   * Update session metrics from event
   * @param {string} sessionId - Session identifier
   * @param {Object} event - Event object
   * @private
   */
  updateSessionFromEvent(sessionId, event) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update metrics
    const metrics = session.metrics;

    if (event.event_type.startsWith('tool_')) {
      if (event.status === 'success') {
        metrics.total_tools_used++;
      }
    }

    if (event.event_type.startsWith('mcp_')) {
      if (event.status === 'success') {
        metrics.total_mcp_calls++;
      }
    }

    if (event.status === 'error') {
      metrics.error_count++;
    }

    // Update active operations
    if (event.status === 'started' || event.status === 'running') {
      const operation = {
        id: event.id,
        type: event.event_type,
        name: event.details?.name || event.event_type,
        started: event.timestamp
      };
      
      // Remove if already exists (update)
      session.active_operations = session.active_operations.filter(op => op.id !== event.id);
      session.active_operations.push(operation);
      
    } else if (event.status === 'success' || event.status === 'error' || event.status === 'timeout') {
      // Remove from active operations
      session.active_operations = session.active_operations.filter(op => op.id !== event.id);
    }

    // Auto-update session status based on events
    if (event.event_type === EVENT_TYPES.TASK_STARTED) {
      session.status = SESSION_STATUS.ACTIVE;
    } else if (event.event_type === EVENT_TYPES.TASK_COMPLETE) {
      if (session.active_operations.length === 0) {
        session.status = SESSION_STATUS.COMPLETED;
      }
    } else if (event.event_type === EVENT_TYPES.TASK_FAILED) {
      session.status = SESSION_STATUS.FAILED;
    }
  }

  /**
   * Limit tree depth by removing children beyond max depth
   * @param {Object} node - Tree node
   * @param {number} maxDepth - Maximum depth
   * @param {number} currentDepth - Current depth
   * @private
   */
  limitTreeDepth(node, maxDepth, currentDepth = 0) {
    if (!node) return;

    if (currentDepth >= maxDepth) {
      node.children = [];
      return;
    }

    for (const child of node.children || []) {
      this.limitTreeDepth(child, maxDepth, currentDepth + 1);
    }
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of active sessions
   */
  getActiveSessions() {
    const active = [];
    for (const session of this.sessions.values()) {
      if (session.status === SESSION_STATUS.ACTIVE) {
        active.push(session);
      }
    }
    return active;
  }

  /**
   * Clean up expired sessions
   * @private
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - new Date(session.start_time).getTime();
      
      if (sessionAge > this.sessionTimeoutMs) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      this.sessions.delete(sessionId);
      this.sessionEvents.delete(sessionId);
      console.error(`Cleaned up expired session: ${sessionId}`);
    }

    if (toDelete.length > 0) {
      console.error(`Cleaned up ${toDelete.length} expired sessions`);
    }
  }

  /**
   * Start cleanup timer
   * @private
   */
  startCleanupTimer() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Stop cleanup timer (for tests and shutdown)
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get server statistics
   * @returns {Object} Server stats
   */
  getStats() {
    const totalSessions = this.sessions.size;
    const activeSessions = this.getActiveSessions().length;
    const totalEvents = Array.from(this.sessionEvents.values())
      .reduce((sum, events) => sum + events.length, 0);

    return {
      total_sessions: totalSessions,
      active_sessions: activeSessions,
      total_events: totalEvents,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
  }
}