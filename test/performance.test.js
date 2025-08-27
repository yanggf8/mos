/**
 * Performance Tests for MCP Observability Server
 * Tests throughput, latency, and resource usage under load
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { performance } from 'perf_hooks';

import { SessionManager } from '../src/session-manager.js';
import { ActivityStreamer } from '../src/activity-streamer.js';
import { HealthMonitor } from '../src/health-monitor.js';
import { ErrorHandler } from '../src/error-handler.js';
import { createEvent, EVENT_TYPES } from '../src/types.js';

describe('Performance Tests', () => {
  
  test('Session Manager - High Volume Event Processing', async () => {
    const manager = new SessionManager({ maxEventsPerSession: 3000 });
    const sessionId = 'perf-test-session';
    const eventCount = 1000;
    
    manager.createSession(sessionId, 'Performance Test Task');
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Generate high volume of events
    for (let i = 0; i < eventCount; i++) {
      const event = createEvent({
        sessionId,
        eventType: EVENT_TYPES.TOOL_PRE_CALL,
        details: { 
          name: `tool_${i}`,
          description: `Performance test tool call ${i}`
        }
      });
      
      manager.addEvent(sessionId, event);
      
      // Complete the tool call
      const completeEvent = createEvent({
        sessionId,
        eventType: EVENT_TYPES.TOOL_POST_CALL,
        status: 'success',
        duration: Math.random() * 1000,
        details: { 
          name: `tool_${i}`,
          description: `Completed tool call ${i}`
        }
      });
      
      manager.addEvent(sessionId, completeEvent);
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB
    
    console.log(`Processed ${eventCount * 2} events in ${duration.toFixed(2)}ms`);
    console.log(`Average event processing: ${(duration / (eventCount * 2)).toFixed(3)}ms`);
    console.log(`Memory usage: ${memoryDelta.toFixed(2)}MB`);
    console.log(`Events per second: ${((eventCount * 2) / (duration / 1000)).toFixed(0)}`);
    
    // Performance assertions
    assert.ok(duration < 5000, 'Should process 2000 events in under 5 seconds');
    assert.ok(memoryDelta < 50, 'Memory usage should be under 50MB for 2000 events');
    
    // Verify data integrity
    const events = manager.getSessionEvents(sessionId);
    assert.strictEqual(events.length, eventCount * 2);
    
    // Test activity tree building performance
    const treeStartTime = performance.now();
    const tree = manager.buildActivityTree(sessionId);
    const treeEndTime = performance.now();
    
    console.log(`Activity tree built in ${(treeEndTime - treeStartTime).toFixed(2)}ms`);
    assert.ok(treeEndTime - treeStartTime < 500, 'Activity tree should build in under 500ms');
  });

  test('Activity Streamer - Concurrent Streams', async () => {
    const streamer = new ActivityStreamer();
    const sessionCount = 10;
    const eventsPerSession = 100;
    
    // Create multiple concurrent streams
    const streamIds = [];
    for (let i = 0; i < sessionCount; i++) {
      const streamId = streamer.startStream(`session-${i}`);
      streamIds.push(streamId);
    }
    
    let totalUpdatesReceived = 0;
    streamer.on('stream_update', () => {
      totalUpdatesReceived++;
    });
    
    const startTime = performance.now();
    
    // Send events to all sessions concurrently
    const promises = [];
    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++) {
      const promise = async () => {
        for (let eventIndex = 0; eventIndex < eventsPerSession; eventIndex++) {
          const event = createEvent({
            sessionId: `session-${sessionIndex}`,
            eventType: EVENT_TYPES.TASK_STARTED,
            details: { name: `Task ${eventIndex}` }
          });
          
          streamer.broadcastEvent(`session-${sessionIndex}`, event);
          
          // Small delay to simulate realistic event timing
          if (eventIndex % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      };
      promises.push(promise());
    }
    
    await Promise.all(promises);
    
    // Give time for all events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const totalEvents = sessionCount * eventsPerSession;
    
    console.log(`Streamed ${totalEvents} events to ${sessionCount} concurrent streams`);
    console.log(`Total duration: ${duration.toFixed(2)}ms`);
    console.log(`Updates received: ${totalUpdatesReceived}`);
    console.log(`Events per second: ${(totalEvents / (duration / 1000)).toFixed(0)}`);
    
    // Performance assertions
    assert.ok(duration < 2000, 'Should handle concurrent streaming in under 2 seconds');
    assert.strictEqual(totalUpdatesReceived, totalEvents);
    
    // Cleanup
    streamIds.forEach(id => streamer.stopStream(id));
  });

  test('Health Monitor - Metrics Collection Under Load', async () => {
    const healthMonitor = new HealthMonitor();
    const requestCount = 500;
    const methods = ['log_event', 'get_activity_tree', 'stream_activity'];
    
    const startTime = performance.now();
    
    // Simulate high request volume
    for (let i = 0; i < requestCount; i++) {
      const method = methods[i % methods.length];
      const requestStart = performance.now();
      
      // Simulate request processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      const requestEnd = performance.now();
      const success = Math.random() > 0.05; // 5% error rate
      
      healthMonitor.recordRequest(method, requestStart, success, requestEnd);
      
      // Record some events
      if (i % 10 === 0) {
        healthMonitor.recordEvent(EVENT_TYPES.TOOL_PRE_CALL, Math.random() * 50);
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Get health metrics
    const health = healthMonitor.getHealthStatus();
    const detailed = healthMonitor.getDetailedMetrics();
    
    console.log(`Health monitoring processed ${requestCount} requests in ${duration.toFixed(2)}ms`);
    console.log(`Health status: ${health.status}`);
    console.log(`Total requests: ${health.requests.total}`);
    console.log(`Error rate: ${(health.requests.error_rate * 100).toFixed(2)}%`);
    console.log(`Avg response time: ${health.requests.avg_response_time_ms.toFixed(2)}ms`);
    
    // Performance assertions
    assert.ok(duration < 10000, 'Health monitoring should handle load efficiently');
    assert.strictEqual(health.requests.total, requestCount);
    assert.ok(health.requests.error_rate <= 0.06, 'Error rate should be close to expected 5%');
    assert.ok(detailed.method_breakdown, 'Should have method breakdown');
  });

  test('Error Handler - Retry Performance', async () => {
    const healthMonitor = new HealthMonitor();
    const errorHandler = new ErrorHandler(healthMonitor);
    
    let callCount = 0;
    const flakeyFunction = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };
    
    const wrappedFn = errorHandler.wrapWithErrorHandling(
      flakeyFunction,
      'test_function',
      { retries: 3, timeout: 1000 }
    );
    
    const startTime = performance.now();
    const result = await wrappedFn();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    
    console.log(`Error handler with retries took ${duration.toFixed(2)}ms`);
    console.log(`Function called ${callCount} times`);
    
    assert.strictEqual(result, 'success');
    assert.strictEqual(callCount, 3);
    assert.ok(duration < 5000, 'Retries should complete in reasonable time');
  });

  test('Memory Usage - Session Cleanup', async () => {
    const manager = new SessionManager({
      maxEventsPerSession: 100,
      sessionTimeoutMs: 100 // Very short for testing
    });
    
    const startMemory = process.memoryUsage().heapUsed;
    
    // Create many sessions with events
    const sessionCount = 50;
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = `memory-test-${i}`;
      manager.createSession(sessionId, `Memory Test ${i}`);
      
      // Add events to each session
      for (let j = 0; j < 50; j++) {
        const event = createEvent({
          sessionId,
          eventType: EVENT_TYPES.TASK_STARTED,
          details: { name: `Task ${j}` }
        });
        manager.addEvent(sessionId, event);
      }
    }
    
    const afterCreationMemory = process.memoryUsage().heapUsed;
    const creationDelta = (afterCreationMemory - startMemory) / 1024 / 1024;
    
    console.log(`Created ${sessionCount} sessions with events: ${creationDelta.toFixed(2)}MB`);
    
    // Wait for cleanup to trigger
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Force cleanup
    manager.cleanup();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const afterCleanupMemory = process.memoryUsage().heapUsed;
    const cleanupDelta = (afterCleanupMemory - startMemory) / 1024 / 1024;
    
    console.log(`After cleanup: ${cleanupDelta.toFixed(2)}MB`);
    console.log(`Memory recovered: ${(creationDelta - cleanupDelta).toFixed(2)}MB`);
    
    // Should have cleaned up most memory
    assert.ok(cleanupDelta < creationDelta * 0.5, 'Should recover at least 50% of memory');
  });

  test('End-to-End Performance - Realistic Workload', async () => {
    const sessionManager = new SessionManager();
    const activityStreamer = new ActivityStreamer();
    const healthMonitor = new HealthMonitor();
    const errorHandler = new ErrorHandler(healthMonitor);
    
    // Simulate realistic Claude Code session
    const sessionId = 'e2e-perf-test';
    sessionManager.createSession(sessionId, 'Full Stack Development Task');
    
    const streamId = activityStreamer.startStream(sessionId);
    let streamUpdates = 0;
    
    activityStreamer.on('stream_update', () => {
      streamUpdates++;
    });
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Simulate complex task with nested operations
    const taskEvents = [
      { type: EVENT_TYPES.TASK_STARTED, name: 'Implement authentication' },
      { type: EVENT_TYPES.TOOL_PRE_CALL, name: 'file_read', duration: 100 },
      { type: EVENT_TYPES.TOOL_POST_CALL, name: 'file_read', duration: 100 },
      { type: EVENT_TYPES.SUBAGENT_SPAWN, name: 'code_reviewer' },
      { type: EVENT_TYPES.TOOL_PRE_CALL, name: 'edit_file', duration: 800 },
      { type: EVENT_TYPES.MCP_REQUEST, name: 'database_query', duration: 300 },
      { type: EVENT_TYPES.MCP_RESPONSE, name: 'database_query', duration: 300 },
      { type: EVENT_TYPES.TOOL_POST_CALL, name: 'edit_file', duration: 800 },
      { type: EVENT_TYPES.SUBAGENT_COMPLETE, name: 'code_reviewer', duration: 2000 },
      { type: EVENT_TYPES.TASK_COMPLETE, name: 'Implement authentication', duration: 5000 }
    ];
    
    for (const eventData of taskEvents) {
      const event = createEvent({
        sessionId,
        eventType: eventData.type,
        status: eventData.type.includes('complete') || eventData.type.includes('post') || eventData.type.includes('response') ? 'success' : 'started',
        duration: eventData.duration,
        details: { name: eventData.name }
      });
      
      const eventStart = performance.now();
      sessionManager.addEvent(sessionId, event);
      activityStreamer.broadcastEvent(sessionId, event);
      const eventEnd = performance.now();
      
      healthMonitor.recordEvent(event.event_type, eventEnd - eventStart);
      healthMonitor.recordRequest('log_event', eventStart, true, eventEnd);
      
      // Small delay to simulate realistic timing
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Build activity tree
    const treeStart = performance.now();
    const tree = sessionManager.buildActivityTree(sessionId);
    const treeEnd = performance.now();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    const totalDuration = endTime - startTime;
    const memoryUsage = (endMemory - startMemory) / 1024 / 1024;
    const treeBuildTime = treeEnd - treeStart;
    
    console.log(`\nEnd-to-End Performance Results:`);
    console.log(`Total duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`Memory usage: ${memoryUsage.toFixed(2)}MB`);
    console.log(`Events processed: ${taskEvents.length}`);
    console.log(`Stream updates: ${streamUpdates}`);
    console.log(`Tree build time: ${treeBuildTime.toFixed(2)}ms`);
    console.log(`Avg event processing: ${(totalDuration / taskEvents.length).toFixed(2)}ms`);
    
    const health = healthMonitor.getHealthStatus();
    console.log(`Health status: ${health.status}`);
    console.log(`Memory usage: ${health.memory.current_mb}MB`);
    
    // Performance assertions
    assert.ok(totalDuration < 2000, 'End-to-end processing should be under 2 seconds');
    assert.ok(memoryUsage < 50, 'Memory usage should be under 50MB for realistic workload');
    assert.ok(treeBuildTime < 100, 'Activity tree should build quickly');
    assert.ok(streamUpdates >= taskEvents.length, `Should receive at least ${taskEvents.length} stream updates, got ${streamUpdates}`);
    assert.ok(['healthy', 'warning'].includes(health.status), 'Health status should be healthy or warning');
    
    // Cleanup
    activityStreamer.stopStream(streamId);
  });
});

console.log('Running performance tests...');