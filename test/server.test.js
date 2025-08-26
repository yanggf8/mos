/**
 * Basic tests for the MCP Observability Server
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import { SessionManager } from '../src/session-manager.js';
import { ActivityStreamer } from '../src/activity-streamer.js';
import { createEvent, createSession, EVENT_TYPES, SESSION_STATUS } from '../src/types.js';
import { formatEventLine, formatDuration } from '../src/formatter.js';

describe('Types and Utilities', () => {
  test('createEvent creates valid event object', () => {
    const event = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TASK_STARTED,
      details: { name: 'Test Task' }
    });

    assert.strictEqual(event.session_id, 'test-session');
    assert.strictEqual(event.event_type, EVENT_TYPES.TASK_STARTED);
    assert.strictEqual(event.status, 'started');
    assert.ok(event.timestamp);
    assert.ok(event.display_info);
  });

  test('createSession creates valid session object', () => {
    const session = createSession('test-session', 'Test Task');

    assert.strictEqual(session.id, 'test-session');
    assert.strictEqual(session.root_task, 'Test Task');
    assert.strictEqual(session.status, SESSION_STATUS.ACTIVE);
    assert.ok(session.start_time);
    assert.ok(session.metrics);
  });

  test('formatDuration formats correctly', () => {
    assert.strictEqual(formatDuration(150), '150ms');
    assert.strictEqual(formatDuration(1500), '1.5s');
    assert.strictEqual(formatDuration(75000), '1m 15s');
  });
});

describe('SessionManager', () => {
  test('creates and retrieves sessions', () => {
    const manager = new SessionManager();
    const session = manager.createSession('test-session', 'Test Task');

    assert.strictEqual(session.id, 'test-session');
    assert.strictEqual(session.root_task, 'Test Task');

    const retrieved = manager.getSession('test-session');
    assert.deepStrictEqual(retrieved, session);
  });

  test('adds and retrieves events', () => {
    const manager = new SessionManager();
    manager.createSession('test-session');

    const event = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TASK_STARTED,
      details: { name: 'Test Task' }
    });

    const addedEvent = manager.addEvent('test-session', event);
    assert.ok(addedEvent.id); // Should have ID added

    const events = manager.getSessionEvents('test-session');
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event_type, EVENT_TYPES.TASK_STARTED);
  });

  test('builds activity tree correctly', () => {
    const manager = new SessionManager();
    manager.createSession('test-session', 'Root Task');

    // Add parent task
    const parentEvent = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TASK_STARTED,
      details: { name: 'Parent Task' }
    });
    const parent = manager.addEvent('test-session', parentEvent);

    // Add child tool call
    const childEvent = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TOOL_PRE_CALL,
      parentId: parent.id,
      details: { name: 'file_read' }
    });
    manager.addEvent('test-session', childEvent);

    const tree = manager.buildActivityTree('test-session');
    assert.ok(tree.root_task);
    assert.strictEqual(tree.root_task.children.length, 1);
    assert.strictEqual(tree.root_task.children[0].name, 'file_read');
  });

  test('updates session metrics from events', () => {
    const manager = new SessionManager();
    const session = manager.createSession('test-session');

    // Add tool event
    const toolEvent = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TOOL_POST_CALL,
      status: 'success',
      details: { name: 'file_read' }
    });
    manager.addEvent('test-session', toolEvent);

    // Add MCP event
    const mcpEvent = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.MCP_RESPONSE,
      status: 'success',
      details: { name: 'database_query' }
    });
    manager.addEvent('test-session', mcpEvent);

    // Add error event
    const errorEvent = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TOOL_ERROR,
      status: 'error',
      details: { name: 'failed_tool' }
    });
    manager.addEvent('test-session', errorEvent);

    const updated = manager.getSession('test-session');
    assert.strictEqual(updated.metrics.total_tools_used, 1);
    assert.strictEqual(updated.metrics.total_mcp_calls, 1);
    assert.strictEqual(updated.metrics.error_count, 1);
  });
});

describe('ActivityStreamer', () => {
  test('starts and stops streams', () => {
    const streamer = new ActivityStreamer();
    const streamId = streamer.startStream('test-session');

    assert.ok(streamId);
    const info = streamer.getStreamInfo(streamId);
    assert.strictEqual(info.session_id, 'test-session');
    assert.strictEqual(info.is_active, true);

    streamer.stopStream(streamId);
    const infoAfterStop = streamer.getStreamInfo(streamId);
    assert.strictEqual(infoAfterStop, null);
  });

  test('broadcasts events to streams', (t, done) => {
    const streamer = new ActivityStreamer();
    const streamId = streamer.startStream('test-session');

    let eventReceived = false;
    
    streamer.on('stream_update', (update) => {
      assert.strictEqual(update.stream_id, streamId);
      assert.strictEqual(update.session_id, 'test-session');
      assert.ok(update.output);
      eventReceived = true;
      done();
    });

    const event = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TASK_STARTED,
      details: { name: 'Test Task' }
    });

    streamer.broadcastEvent('test-session', event);
    
    // Give it a moment to process
    setTimeout(() => {
      if (!eventReceived) {
        assert.fail('Event was not received by stream');
        done();
      }
    }, 100);
  });
});

describe('Formatter', () => {
  test('formats event lines correctly', () => {
    const event = createEvent({
      sessionId: 'test-session',
      eventType: EVENT_TYPES.TOOL_POST_CALL,
      status: 'success',
      duration: 150,
      details: { name: 'file_read', description: 'Reading config file' }
    });
    event.duration_ms = 150;

    const formatted = formatEventLine(event, {
      showTimings: true,
      showIcons: true,
      indentLevel: 1,
      isLast: false
    });

    assert.ok(formatted.includes('🔧')); // Tool icon
    assert.ok(formatted.includes('file_read'));
    assert.ok(formatted.includes('150ms'));
    assert.ok(formatted.includes('✅')); // Success status
    assert.ok(formatted.includes('├─')); // Tree character
  });

  test('handles different event types and statuses', () => {
    const runningEvent = createEvent({
      sessionId: 'test',
      eventType: EVENT_TYPES.SUBAGENT_SPAWN,
      status: 'running',
      details: { name: 'code-reviewer' }
    });

    const formatted = formatEventLine(runningEvent);
    assert.ok(formatted.includes('🤖')); // Subagent icon
    assert.ok(formatted.includes('🔄')); // Running status
  });
});

console.log('Running tests...');