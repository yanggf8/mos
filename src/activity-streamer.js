/**
 * Real-time Activity Streaming
 * Handles live event broadcasting and streaming to connected clients
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { formatEventLine, formatSlowOperationAlert, formatError } from './formatter.js';

export class ActivityStreamer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.streams = new Map(); // streamId -> stream config
    this.sessionStreams = new Map(); // sessionId -> Set of streamIds
    this.slowThresholdMs = options.slowThresholdMs || 500;
    this.eventBuffer = new Map(); // sessionId -> recent events for replay
    this.bufferSize = options.bufferSize || 100;
  }

  /**
   * Start a new activity stream for a session
   * @param {string} sessionId - Session to monitor
   * @param {Object} options - Stream configuration
   * @returns {string} Stream ID
   */
  startStream(sessionId, options = {}) {
    const streamId = uuidv4();
    const streamConfig = {
      id: streamId,
      sessionId,
      startTime: new Date().toISOString(),
      options: {
        output_format: options.output_format || 'claude_code_style',
        show_progress: options.show_progress !== false,
        collapse_completed: options.collapse_completed || false,
        show_timings: options.show_timings !== false,
        highlight_errors: options.highlight_errors !== false
      },
      isActive: true,
      eventCount: 0
    };

    this.streams.set(streamId, streamConfig);

    // Track session streams
    if (!this.sessionStreams.has(sessionId)) {
      this.sessionStreams.set(sessionId, new Set());
    }
    this.sessionStreams.get(sessionId).add(streamId);

    console.error(`Started stream ${streamId} for session ${sessionId}`);

    // Send recent events if available
    this.replayRecentEvents(streamId, sessionId);

    return streamId;
  }

  /**
   * Stop an activity stream
   * @param {string} streamId - Stream to stop
   */
  stopStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.isActive = false;
    
    // Remove from session streams
    const sessionStreams = this.sessionStreams.get(stream.sessionId);
    if (sessionStreams) {
      sessionStreams.delete(streamId);
      if (sessionStreams.size === 0) {
        this.sessionStreams.delete(stream.sessionId);
      }
    }

    this.streams.delete(streamId);
    console.error(`Stopped stream ${streamId}`);
  }

  /**
   * Broadcast event to all active streams for a session
   * @param {string} sessionId - Session ID
   * @param {Object} event - Event to broadcast
   */
  broadcastEvent(sessionId, event) {
    // Add to event buffer for replay
    this.addToEventBuffer(sessionId, event);

    const sessionStreams = this.sessionStreams.get(sessionId);
    if (!sessionStreams || sessionStreams.size === 0) {
      return; // No active streams for this session
    }

    for (const streamId of sessionStreams) {
      const stream = this.streams.get(streamId);
      if (!stream || !stream.isActive) continue;

      try {
        this.sendEventToStream(streamId, event);
        stream.eventCount++;
      } catch (error) {
        console.error(`Error sending event to stream ${streamId}:`, error);
        this.stopStream(streamId);
      }
    }
  }

  /**
   * Send event to specific stream
   * @param {string} streamId - Target stream
   * @param {Object} event - Event to send
   * @private
   */
  sendEventToStream(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.isActive) return;

    const { options } = stream;
    let output;

    switch (options.output_format) {
      case 'claude_code_style':
        output = this.formatClaudeCodeStyle(event, options);
        break;
      
      case 'json':
        output = JSON.stringify({
          stream_id: streamId,
          timestamp: new Date().toISOString(),
          event
        });
        break;
        
      case 'plain':
        output = this.formatPlainText(event, options);
        break;
        
      default:
        output = this.formatClaudeCodeStyle(event, options);
    }

    if (output) {
      // Emit to interested parties (could be WebSocket, console, etc.)
      this.emit('stream_update', {
        stream_id: streamId,
        session_id: stream.sessionId,
        output,
        event,
        display_action: this.getDisplayAction(event)
      });
    }

    // Check for slow operations
    if (options.highlight_errors && this.isSlowOperation(event)) {
      const alert = formatSlowOperationAlert(event, this.slowThresholdMs);
      this.emit('stream_update', {
        stream_id: streamId,
        session_id: stream.sessionId,
        output: alert,
        event,
        display_action: 'alert'
      });
    }
  }

  /**
   * Format event in Claude Code style
   * @param {Object} event - Event to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted output
   * @private
   */
  formatClaudeCodeStyle(event, options) {
    // Skip completed events if collapse_completed is enabled
    if (options.collapse_completed && event.status === 'success' && event.duration_ms < 200) {
      return null;
    }

    const formattedLine = formatEventLine(event, {
      showTimings: options.show_timings,
      showIcons: true,
      indentLevel: this.calculateIndentLevel(event),
      isLast: false, // We don't know this in streaming context
      hasChildren: false
    });

    // Add progress indicator for running operations
    if (options.show_progress && event.status === 'running') {
      return formattedLine.replace('🔄', '🔄');
    }

    // Highlight errors
    if (options.highlight_errors && event.status === 'error') {
      const errorMsg = formatError(event);
      return `${formattedLine}\n    ${errorMsg}`;
    }

    return formattedLine;
  }

  /**
   * Format event in plain text
   * @param {Object} event - Event to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted output
   * @private
   */
  formatPlainText(event, options) {
    const timestamp = options.show_timings ? `[${event.timestamp}] ` : '';
    const duration = event.duration_ms && options.show_timings ? ` (${event.duration_ms}ms)` : '';
    const name = event.details?.name || event.event_type;
    const status = event.status;
    
    return `${timestamp}${name}: ${status}${duration}`;
  }

  /**
   * Calculate indent level for event
   * @param {Object} event - Event object
   * @returns {number} Indent level
   * @private
   */
  calculateIndentLevel(event) {
    // Simple heuristic based on event type
    if (event.event_type.startsWith('task_')) return 0;
    if (event.event_type.startsWith('subagent_')) return 1;
    if (event.event_type.startsWith('tool_') || event.event_type.startsWith('mcp_')) return 2;
    return 1;
  }

  /**
   * Determine display action for event
   * @param {Object} event - Event object
   * @returns {string} Display action
   * @private
   */
  getDisplayAction(event) {
    if (event.status === 'started') return 'append';
    if (event.status === 'running') return 'update';
    if (event.status === 'success' || event.status === 'error' || event.status === 'timeout') return 'finalize';
    return 'append';
  }

  /**
   * Check if operation is slow
   * @param {Object} event - Event object
   * @returns {boolean} True if slow
   * @private
   */
  isSlowOperation(event) {
    return event.duration_ms && event.duration_ms > this.slowThresholdMs;
  }

  /**
   * Add event to buffer for replay
   * @param {string} sessionId - Session ID
   * @param {Object} event - Event to buffer
   * @private
   */
  addToEventBuffer(sessionId, event) {
    if (!this.eventBuffer.has(sessionId)) {
      this.eventBuffer.set(sessionId, []);
    }

    const buffer = this.eventBuffer.get(sessionId);
    buffer.push(event);

    // Limit buffer size (circular buffer)
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
  }

  /**
   * Replay recent events to new stream
   * @param {string} streamId - Target stream
   * @param {string} sessionId - Session ID
   * @private
   */
  replayRecentEvents(streamId, sessionId) {
    const buffer = this.eventBuffer.get(sessionId);
    if (!buffer || buffer.length === 0) return;

    // Replay recent events (last 20 or so)
    const recentEvents = buffer.slice(-20);
    
    for (const event of recentEvents) {
      try {
        this.sendEventToStream(streamId, event);
      } catch (error) {
        console.error(`Error replaying event to stream ${streamId}:`, error);
        break;
      }
    }
  }

  /**
   * Get stream statistics
   * @returns {Object} Stream stats
   */
  getStreamStats() {
    const activeStreams = Array.from(this.streams.values())
      .filter(stream => stream.isActive);

    const totalEvents = activeStreams
      .reduce((sum, stream) => sum + stream.eventCount, 0);

    return {
      active_streams: activeStreams.length,
      total_streams: this.streams.size,
      monitored_sessions: this.sessionStreams.size,
      total_events_streamed: totalEvents
    };
  }

  /**
   * Get stream info
   * @param {string} streamId - Stream ID
   * @returns {Object|null} Stream info or null
   */
  getStreamInfo(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return null;

    return {
      id: stream.id,
      session_id: stream.sessionId,
      start_time: stream.startTime,
      is_active: stream.isActive,
      event_count: stream.eventCount,
      options: stream.options
    };
  }

  /**
   * Cleanup inactive streams
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    const toDelete = [];

    for (const [streamId, stream] of this.streams.entries()) {
      if (!stream.isActive) {
        const age = now - new Date(stream.startTime).getTime();
        if (age > maxAge) {
          toDelete.push(streamId);
        }
      }
    }

    for (const streamId of toDelete) {
      this.stopStream(streamId);
    }

    if (toDelete.length > 0) {
      console.error(`Cleaned up ${toDelete.length} inactive streams`);
    }
  }
}