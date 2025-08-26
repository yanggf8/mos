/**
 * Demo script showing the MCP Observability Server in action
 */

import { ClaudeCodeHooks } from './claude-code-hooks.js';

// Mock MCP client for demo
class MockMcpClient {
  constructor(observabilityServer) {
    this.server = observabilityServer;
  }

  async callTool(name, args) {
    // Simulate MCP call to observability server
    return await this.server.handleLogEvent(args);
  }
}

// Mock observability server for demo
class MockObservabilityServer {
  constructor() {
    this.events = [];
  }

  async handleLogEvent(args) {
    const { event } = args;
    this.events.push(event);
    
    // Format and display event in Claude Code style
    const icon = this.getEventIcon(event.event_type);
    const name = event.details?.name || event.event_type;
    const duration = event.duration_ms ? ` (${this.formatDuration(event.duration_ms)})` : '';
    const status = this.getStatusIcon(event.status);
    const indent = '  '.repeat(this.calculateIndent(event));
    
    console.log(`${indent}├─ ${icon} ${name}${duration} ${status}`);
    
    return { content: [{ type: 'text', text: 'Event logged' }] };
  }

  getEventIcon(eventType) {
    const icons = {
      'task_started': '🔄',
      'task_complete': '✅',
      'task_failed': '❌',
      'tool_pre_call': '🔧',
      'tool_post_call': '🔧',
      'mcp_request': '📡',
      'mcp_response': '📡',
      'mcp_error': '🔴',
      'subagent_spawn': '🤖',
      'subagent_complete': '🤖',
      'subagent_failed': '🚫'
    };
    return icons[eventType] || '🔵';
  }

  getStatusIcon(status) {
    const icons = {
      'started': '🔄',
      'running': '🔄',
      'success': '✅',
      'error': '❌',
      'timeout': '⏰'
    };
    return icons[status] || '';
  }

  calculateIndent(event) {
    if (event.event_type.startsWith('task_')) return 0;
    if (event.event_type.startsWith('subagent_')) return 1;
    return 2;
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Run a demo scenario
 */
async function runDemo() {
  console.log('🚀 MCP Observability Server Demo\n');
  
  const server = new MockObservabilityServer();
  const mcpClient = new MockMcpClient(server);
  const hooks = new ClaudeCodeHooks(mcpClient);

  try {
    // Start a session
    await hooks.startSession('Implementing user authentication system');
    
    // Simulate a complex task with tools and subagents
    await simulateComplexTask(hooks);
    
    // End the session
    await hooks.endSession();
    
    console.log(`\n📊 Demo completed! Logged ${server.events.length} events\n`);
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

/**
 * Simulate a complex task with various activities
 */
async function simulateComplexTask(hooks) {
  console.log('🔄 Task: Implementing user authentication system');

  // Start main task
  await hooks.onTaskStart('Read existing auth code');
  
  // Tool calls
  const toolCorr1 = await hooks.onToolPreCall('file_read', { path: 'src/auth.js' });
  await sleep(150);
  await hooks.onToolPostCall('file_read', toolCorr1, true, { content: 'auth code...' }, 150);

  const toolCorr2 = await hooks.onToolPreCall('file_read', { path: 'src/user.js' });
  await sleep(200);
  await hooks.onToolPostCall('file_read', toolCorr2, true, { content: 'user code...' }, 200);

  await hooks.onTaskComplete('Read existing auth code', true);

  // Start another task with subagent
  await hooks.onTaskStart('Implement JWT authentication');

  // Spawn subagent
  const subagentCorr = await hooks.onSubagentSpawn('security-reviewer', 'Review auth implementation');
  
  // More tool calls during subagent work
  const toolCorr3 = await hooks.onToolPreCall('edit_file', { path: 'src/auth.js', changes: 'Add JWT logic' });
  await sleep(800);
  await hooks.onToolPostCall('edit_file', toolCorr3, true, { success: true }, 800);

  // MCP calls
  const mcpCorr1 = await hooks.onMcpRequest('database-server', 'create_table', { name: 'sessions' });
  await sleep(300);
  await hooks.onMcpResponse('database-server', 'create_table', mcpCorr1, true, { created: true }, 300);

  // Complete subagent (slow operation)
  await sleep(2100);
  await hooks.onSubagentComplete('security-reviewer', subagentCorr, true, 'Security review passed', 2100);

  // Test the implementation
  const toolCorr4 = await hooks.onToolPreCall('test_runner', { suite: 'auth_tests' });
  await sleep(450);
  await hooks.onToolPostCall('test_runner', toolCorr4, true, { passed: 15, failed: 0 }, 450);

  await hooks.onTaskComplete('Implement JWT authentication', true);

  // Final task with an error scenario
  await hooks.onTaskStart('Deploy authentication changes');
  
  const toolCorr5 = await hooks.onToolPreCall('build_project', {});
  await sleep(1200);
  await hooks.onToolPostCall('build_project', toolCorr5, true, { success: true }, 1200);

  const mcpCorr2 = await hooks.onMcpRequest('deploy-server', 'deploy', { env: 'staging' });
  await sleep(600);
  await hooks.onMcpResponse('deploy-server', 'deploy', mcpCorr2, false, { error: 'Connection timeout' }, 600);

  await hooks.onTaskComplete('Deploy authentication changes', false);
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}