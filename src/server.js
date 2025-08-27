/**
 * MCP Observability Server
 * Real-time Claude Code activity monitoring
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { performance } from 'perf_hooks';

import { SessionManager } from './session-manager.js';
import { ActivityStreamer } from './activity-streamer.js';
import { HealthMonitor } from './health-monitor.js';
import { ErrorHandler } from './error-handler.js';
import { createEvent, validateEvent, EVENT_TYPES } from './types.js';
import { formatActivityTree, formatSessionSummary } from './formatter.js';
import { 
  formatMCPResponse,
  formatClaudeCodeTaskProgress,
  formatClaudeCodeSessionSummary,
  formatClaudeCodeHealthStatus,
  formatClaudeCodeActivityStream
} from './claude-code-formatter.js';
import { autoConfigureClaudeCode } from './claude-code-auto-config.js';

class ObservabilityServer {
  constructor(options = {}) {
    this.server = new Server(
      {
        name: 'mcp-observability-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize monitoring and error handling
    this.healthMonitor = new HealthMonitor(options.health);
    this.errorHandler = new ErrorHandler(this.healthMonitor);
    
    this.sessionManager = new SessionManager(options.session);
    this.activityStreamer = new ActivityStreamer(options.streaming);
    this.displaySettings = new Map();

    this.setupHealthMonitoring();
    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'stream_activity',
          description: 'Stream real-time activity updates for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier to monitor'
              },
              output_format: {
                type: 'string', 
                enum: ['claude_code_style', 'json', 'plain'],
                default: 'claude_code_style',
                description: 'Output format style'
              },
              show_progress: {
                type: 'boolean',
                default: true,
                description: 'Show progress indicators for running operations'
              },
              collapse_completed: {
                type: 'boolean', 
                default: false,
                description: 'Collapse completed operations'
              }
            },
            required: ['session_id']
          }
        },
        {
          name: 'get_activity_tree',
          description: 'Get hierarchical view of session activities',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier'
              },
              include_completed: {
                type: 'boolean',
                default: true,
                description: 'Include completed activities'
              },
              max_depth: {
                type: 'number',
                default: 5,
                description: 'Maximum tree depth to display'
              }
            },
            required: ['session_id']
          }
        },
        {
          name: 'configure_display',
          description: 'Configure display settings for a session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier'
              },
              settings: {
                type: 'object',
                properties: {
                  show_timings: {
                    type: 'boolean',
                    default: true
                  },
                  collapse_fast_ops: {
                    type: 'boolean', 
                    default: true
                  },
                  threshold_slow_ms: {
                    type: 'number',
                    default: 500
                  },
                  max_tree_depth: {
                    type: 'number',
                    default: 3
                  },
                  highlight_errors: {
                    type: 'boolean',
                    default: true
                  }
                }
              }
            },
            required: ['session_id', 'settings']
          }
        },
        {
          name: 'export_session',
          description: 'Export session data in specified format',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier to export'
              },
              format: {
                type: 'string',
                enum: ['claude_code_log', 'json', 'text'],
                default: 'json',
                description: 'Export format'
              }
            },
            required: ['session_id']
          }
        },
        {
          name: 'log_event',
          description: 'Log a new activity event (used by Claude Code hooks)',
          inputSchema: {
            type: 'object',
            properties: {
              event: {
                type: 'object',
                properties: {
                  session_id: { type: 'string' },
                  event_type: { type: 'string' },
                  status: { type: 'string' },
                  duration_ms: { type: 'number' },
                  parent_id: { type: 'string' },
                  correlation_id: { type: 'string' },
                  details: { type: 'object' }
                },
                required: ['session_id', 'event_type', 'status']
              }
            },
            required: ['event']
          }
        },
        {
          name: 'get_health_status',
          description: 'Get server health and performance metrics',
          inputSchema: {
            type: 'object',
            properties: {
              detailed: {
                type: 'boolean',
                default: false,
                description: 'Include detailed metrics and diagnostics'
              }
            }
          }
        }
      ]
    }));

    // Handle tool calls with error handling and monitoring
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = performance.now();

      const handler = this.errorHandler.wrapWithErrorHandling(async () => {
        switch (name) {
          case 'stream_activity':
            return await this.handleStreamActivity(args);
          
          case 'get_activity_tree':
            return await this.handleGetActivityTree(args);
            
          case 'configure_display':
            return await this.handleConfigureDisplay(args);
            
          case 'export_session':
            return await this.handleExportSession(args);
            
          case 'log_event':
            return await this.handleLogEvent(args);

          case 'get_health_status':
            return await this.handleGetHealthStatus(args);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      }, `tool:${name}`, {
        retries: name === 'log_event' ? 2 : 0,
        timeout: 30000,
        circuitBreaker: true
      });

      try {
        const result = await handler();
        this.healthMonitor.recordRequest(name, startTime, true);
        return result;
      } catch (error) {
        this.healthMonitor.recordRequest(name, startTime, false);
        throw this.errorHandler.handleToolError(error, name, args);
      }
    });
  }

  setupHealthMonitoring() {
    // Update session metrics periodically
    setInterval(() => {
      const stats = this.sessionManager.getStats();
      this.healthMonitor.recordSessions(
        stats.total_sessions,
        stats.active_sessions
      );
    }, 5000);

    // Log health status periodically
    this.healthMonitor.on('health_check', (health) => {
      if (health.status !== 'healthy') {
        console.warn('Health check:', health.status, health);
      }
    });

    // Handle alerts
    this.healthMonitor.on('alert', (alert) => {
      console.error(`[${alert.severity.toUpperCase()}] ${alert.type}:`, alert.data);
    });

    // Activity streamer cleanup
    setInterval(() => {
      this.activityStreamer.cleanup();
    }, 300000); // 5 minutes
  }

  async handleGetHealthStatus(args) {
    const { detailed = false } = args;
    
    let healthData;
    if (detailed) {
      healthData = this.healthMonitor.getDetailedMetrics();
      // Add component-specific stats
      healthData.components = {
        session_manager: this.sessionManager.getStats(),
        activity_streamer: this.activityStreamer.getStreamStats(),
        error_handler: this.errorHandler.getErrorStats()
      };
    } else {
      healthData = this.healthMonitor.getHealthStatus();
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(healthData, null, 2)
        }
      ]
    };
  }

  async handleStreamActivity(args) {
    const { session_id, output_format = 'claude_code_style', show_progress = true, collapse_completed = false } = args;
    
    // Get or create session
    let session = this.sessionManager.getSession(session_id);
    if (!session) {
      session = this.sessionManager.createSession(session_id);
    }

    // Start streaming for this session
    const streamId = this.activityStreamer.startStream(session_id, {
      output_format,
      show_progress,
      collapse_completed
    });

    return {
      content: [
        {
          type: 'text',
          text: `Started activity stream for session ${session_id}\nStream ID: ${streamId}\nFormat: ${output_format}`
        }
      ]
    };
  }

  async handleGetActivityTree(args) {
    const { session_id, include_completed = true, max_depth = 5 } = args;
    
    const session = this.sessionManager.getSession(session_id);
    if (!session) {
      throw new McpError(ErrorCode.InvalidRequest, `Session ${session_id} not found`);
    }

    const activityTree = this.sessionManager.buildActivityTree(session_id, {
      include_completed,
      max_depth
    });

    const formattedLines = formatActivityTree(activityTree, {
      showTimings: true,
      showIcons: true
    });

    return {
      content: [
        {
          type: 'text',
          text: formattedLines.join('\n')
        }
      ]
    };
  }

  async handleConfigureDisplay(args) {
    const { session_id, settings } = args;
    
    this.displaySettings.set(session_id, settings);
    
    return {
      content: [
        {
          type: 'text',
          text: `Display settings updated for session ${session_id}`
        }
      ]
    };
  }

  async handleExportSession(args) {
    const { session_id, format = 'json' } = args;
    
    const session = this.sessionManager.getSession(session_id);
    if (!session) {
      throw new McpError(ErrorCode.InvalidRequest, `Session ${session_id} not found`);
    }

    let exportData;
    switch (format) {
      case 'json':
        exportData = JSON.stringify({
          session,
          events: this.sessionManager.getSessionEvents(session_id)
        }, null, 2);
        break;
        
      case 'text':
        const summary = formatSessionSummary(session);
        const tree = this.sessionManager.buildActivityTree(session_id);
        const lines = formatActivityTree(tree);
        exportData = [summary, '', ...lines].join('\n');
        break;
        
      case 'claude_code_log':
        const activityTree = this.sessionManager.buildActivityTree(session_id);
        exportData = formatActivityTree(activityTree, {
          showTimings: true,
          showIcons: true
        }).join('\n');
        break;
        
      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unsupported format: ${format}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: exportData
        }
      ]
    };
  }

  async handleLogEvent(args) {
    const { event } = args;
    const eventProcessingStart = performance.now();
    
    if (!validateEvent(event)) {
      throw new McpError(ErrorCode.InvalidRequest, 'Invalid event structure');
    }

    try {
      // Ensure session exists
      let session = this.sessionManager.getSession(event.session_id);
      if (!session) {
        session = this.sessionManager.createSession(event.session_id, 
          event.details?.task_name || 'Unknown Task');
      }

      // Add event to session
      const addedEvent = this.sessionManager.addEvent(event.session_id, event);
      
      // Stream the event to any active listeners
      this.activityStreamer.broadcastEvent(event.session_id, addedEvent);

      // Record event processing metrics
      const processingTime = performance.now() - eventProcessingStart;
      this.healthMonitor.recordEvent(event.event_type, processingTime);

      return {
        content: [
          {
            type: 'text',
            text: `Event logged: ${event.event_type} for session ${event.session_id}`
          }
        ]
      };
    } catch (error) {
      throw this.errorHandler.handleSessionError(error, event.session_id, 'log_event');
    }
  }

  async run() {
    // Auto-configure Claude Code if available
    console.error('🚀 Starting MCP Observability Server...');
    
    try {
      const configured = await autoConfigureClaudeCode();
      if (configured) {
        console.error('✅ Claude Code auto-configuration completed');
      }
    } catch (error) {
      console.error('⚠️  Auto-configuration failed:', error.message);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('📊 MCP Observability Server running on stdio');
  }
}

// Start the server
const server = new ObservabilityServer();
server.run().catch(console.error);