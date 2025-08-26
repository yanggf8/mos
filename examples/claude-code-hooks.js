/**
 * Example Claude Code Hook Integration
 * Shows how to integrate the MCP Observability Server with Claude Code hooks
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Mock Claude Code hook implementation
 * In real usage, these would be called by Claude Code itself
 */
export class ClaudeCodeHooks {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
    this.sessionId = null;
    this.correlationIdStack = [];
    this.taskStack = [];
  }

  /**
   * Initialize a new session
   * @param {string} rootTask - Description of the root task
   */
  async startSession(rootTask = 'Unknown Task') {
    this.sessionId = uuidv4();
    console.log(`Starting session: ${this.sessionId} - ${rootTask}`);

    await this.logEvent({
      event_type: 'task_started',
      status: 'started',
      details: {
        name: rootTask,
        description: rootTask,
        task_name: rootTask
      }
    });

    this.taskStack.push({
      name: rootTask,
      startTime: Date.now(),
      correlationId: uuidv4()
    });

    return this.sessionId;
  }

  /**
   * Task start hook
   * @param {string} taskName - Name of the task
   */
  async onTaskStart(taskName) {
    const correlationId = uuidv4();
    this.correlationIdStack.push(correlationId);
    
    const parentId = this.taskStack.length > 0 ? 
      this.taskStack[this.taskStack.length - 1].correlationId : null;

    await this.logEvent({
      event_type: 'task_started',
      status: 'started',
      parent_id: parentId,
      correlation_id: correlationId,
      details: {
        name: taskName,
        description: taskName
      }
    });

    this.taskStack.push({
      name: taskName,
      startTime: Date.now(),
      correlationId
    });
  }

  /**
   * Task completion hook
   * @param {string} taskName - Name of the task
   * @param {boolean} success - Whether task succeeded
   */
  async onTaskComplete(taskName, success = true) {
    if (this.taskStack.length === 0) return;

    const task = this.taskStack.pop();
    const correlationId = this.correlationIdStack.pop() || task.correlationId;
    const duration = Date.now() - task.startTime;

    await this.logEvent({
      event_type: success ? 'task_complete' : 'task_failed',
      status: success ? 'success' : 'error',
      correlation_id: correlationId,
      duration_ms: duration,
      details: {
        name: taskName,
        description: taskName
      }
    });
  }

  /**
   * Tool pre-call hook
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Tool arguments
   */
  async onToolPreCall(toolName, args = {}) {
    const correlationId = uuidv4();
    this.correlationIdStack.push(correlationId);

    const parentId = this.taskStack.length > 0 ? 
      this.taskStack[this.taskStack.length - 1].correlationId : null;

    await this.logEvent({
      event_type: 'tool_pre_call',
      status: 'started',
      parent_id: parentId,
      correlation_id: correlationId,
      details: {
        name: toolName,
        description: `Calling ${toolName}`,
        input_summary: this.summarizeArgs(args)
      }
    });

    return correlationId;
  }

  /**
   * Tool post-call hook
   * @param {string} toolName - Name of the tool
   * @param {string} correlationId - Correlation ID from pre-call
   * @param {boolean} success - Whether tool call succeeded
   * @param {Object} result - Tool result
   * @param {number} duration - Duration in milliseconds
   */
  async onToolPostCall(toolName, correlationId, success, result = null, duration = 0) {
    this.correlationIdStack = this.correlationIdStack.filter(id => id !== correlationId);

    await this.logEvent({
      event_type: 'tool_post_call',
      status: success ? 'success' : 'error',
      correlation_id: correlationId,
      duration_ms: duration,
      details: {
        name: toolName,
        description: `Completed ${toolName}`,
        output_summary: success ? this.summarizeResult(result) : 'Failed',
        error_message: success ? null : result?.error || 'Unknown error'
      }
    });
  }

  /**
   * MCP request hook
   * @param {string} server - MCP server name
   * @param {string} method - MCP method
   * @param {Object} params - Request parameters
   */
  async onMcpRequest(server, method, params = {}) {
    const correlationId = uuidv4();
    this.correlationIdStack.push(correlationId);

    const parentId = this.taskStack.length > 0 ? 
      this.taskStack[this.taskStack.length - 1].correlationId : null;

    await this.logEvent({
      event_type: 'mcp_request',
      status: 'started',
      parent_id: parentId,
      correlation_id: correlationId,
      details: {
        name: `${server}:${method}`,
        description: `MCP call to ${server}`,
        input_summary: `${method}(${Object.keys(params).join(', ')})`
      }
    });

    return correlationId;
  }

  /**
   * MCP response hook
   * @param {string} server - MCP server name
   * @param {string} method - MCP method
   * @param {string} correlationId - Correlation ID from request
   * @param {boolean} success - Whether call succeeded
   * @param {Object} response - Response data
   * @param {number} duration - Duration in milliseconds
   */
  async onMcpResponse(server, method, correlationId, success, response = null, duration = 0) {
    this.correlationIdStack = this.correlationIdStack.filter(id => id !== correlationId);

    await this.logEvent({
      event_type: success ? 'mcp_response' : 'mcp_error',
      status: success ? 'success' : 'error',
      correlation_id: correlationId,
      duration_ms: duration,
      details: {
        name: `${server}:${method}`,
        description: `MCP response from ${server}`,
        output_summary: success ? 'Success' : 'Failed',
        error_message: success ? null : response?.error || 'Unknown error'
      }
    });
  }

  /**
   * Subagent spawn hook
   * @param {string} agentType - Type of subagent
   * @param {string} task - Task for the subagent
   */
  async onSubagentSpawn(agentType, task) {
    const correlationId = uuidv4();
    this.correlationIdStack.push(correlationId);

    const parentId = this.taskStack.length > 0 ? 
      this.taskStack[this.taskStack.length - 1].correlationId : null;

    await this.logEvent({
      event_type: 'subagent_spawn',
      status: 'started',
      parent_id: parentId,
      correlation_id: correlationId,
      details: {
        name: agentType,
        description: `Spawning ${agentType} subagent`,
        input_summary: task
      }
    });

    return correlationId;
  }

  /**
   * Subagent completion hook
   * @param {string} agentType - Type of subagent
   * @param {string} correlationId - Correlation ID from spawn
   * @param {boolean} success - Whether subagent succeeded
   * @param {string} result - Result description
   * @param {number} duration - Duration in milliseconds
   */
  async onSubagentComplete(agentType, correlationId, success, result = '', duration = 0) {
    this.correlationIdStack = this.correlationIdStack.filter(id => id !== correlationId);

    await this.logEvent({
      event_type: success ? 'subagent_complete' : 'subagent_failed',
      status: success ? 'success' : 'error',
      correlation_id: correlationId,
      duration_ms: duration,
      details: {
        name: agentType,
        description: `Completed ${agentType} subagent`,
        output_summary: result,
        error_message: success ? null : result
      }
    });
  }

  /**
   * Log event to MCP server
   * @param {Object} event - Event to log
   * @private
   */
  async logEvent(event) {
    if (!this.sessionId) {
      console.error('No active session for event:', event);
      return;
    }

    const fullEvent = {
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      ...event
    };

    try {
      await this.mcpClient.callTool('log_event', { event: fullEvent });
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  /**
   * Summarize tool arguments for display
   * @param {Object} args - Tool arguments
   * @returns {string} Summary string
   * @private
   */
  summarizeArgs(args) {
    if (!args || Object.keys(args).length === 0) return '';
    
    const keys = Object.keys(args);
    if (keys.length === 1) {
      const value = args[keys[0]];
      if (typeof value === 'string' && value.length > 50) {
        return `${keys[0]}: ${value.substring(0, 47)}...`;
      }
      return `${keys[0]}: ${value}`;
    }
    
    return `{${keys.join(', ')}}`;
  }

  /**
   * Summarize tool result for display
   * @param {Object} result - Tool result
   * @returns {string} Summary string
   * @private
   */
  summarizeResult(result) {
    if (!result) return 'No result';
    
    if (typeof result === 'string') {
      return result.length > 50 ? result.substring(0, 47) + '...' : result;
    }
    
    if (result.content && Array.isArray(result.content) && result.content.length > 0) {
      const firstContent = result.content[0];
      if (firstContent.text) {
        const text = firstContent.text;
        return text.length > 50 ? text.substring(0, 47) + '...' : text;
      }
    }
    
    return 'Success';
  }

  /**
   * End the current session
   */
  async endSession() {
    if (this.taskStack.length > 0) {
      const rootTask = this.taskStack[0];
      await this.onTaskComplete(rootTask.name, true);
    }

    this.sessionId = null;
    this.correlationIdStack = [];
    this.taskStack = [];
  }
}