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
import { MCPOutputInjector, wrapToolHandlerWithMonitoring } from './mcp-output-injection.js';

class ObservabilityServer {
  constructor(options = {}) {
    this.server = new Server(
      {
        name: 'mos',
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
    
    // Initialize MCP output injection for dynamic monitoring behavior
    this.outputInjector = new MCPOutputInjector(this.sessionManager, this.healthMonitor);

    this.setupHealthMonitoring();
    this.setupHandlers();
    this.setupLifecycleEvents();
  }

  setupHandlers() {
    // List available tools - minimal set since activity shows automatically in responses
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_monitoring_context',
          description: 'Get current monitoring context and activity status (always shows in responses when MOS is active)',
          inputSchema: {
            type: 'object',
            properties: {
              include_health: {
                type: 'boolean',
                default: true,
                description: 'Include system health information'
              },
              include_session_stats: {
                type: 'boolean',
                default: true,
                description: 'Include current session statistics'
              }
            }
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
        // Get or create session ID for monitoring context
        const sessionId = args.session_id || this.generateSessionId();
        
        switch (name) {
          case 'get_monitoring_context':
            return await wrapToolHandlerWithMonitoring(
              this.handleGetMonitoringContext,
              this.outputInjector,
              'get_monitoring_context'
            ).call(this, args, sessionId);
            
          case 'export_session':
            return await wrapToolHandlerWithMonitoring(
              this.handleExportSession, 
              this.outputInjector, 
              'export_session'
            ).call(this, args, sessionId);

          case 'get_health_status':
            return await wrapToolHandlerWithMonitoring(
              this.handleGetHealthStatus, 
              this.outputInjector, 
              'get_health_status'  
            ).call(this, args, sessionId);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      }, `tool:${name}`, {
        retries: 0,
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

  setupLifecycleEvents() {
    // Add MCP lifecycle event handlers
    this.server.oninitialized = this.handleInitialized.bind(this);

    // Override the connect method to add initialization logging
    const originalConnect = this.server.connect.bind(this.server);
    this.server.connect = async (transport) => {
      console.error('[MOS] Starting initialization sequence');
      const result = await originalConnect(transport);
      console.error('[MOS] Server initialization sequence completed');
      console.error('[MOS] 📡 Dynamic monitoring injection activated');
      return result;
    };
  }

  /**
   * Generate a session ID for monitoring context
   */
  generateSessionId() {
    return `mcp-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  handleInitialized() {
    console.error('[MOS] Server initialized and ready for requests');
    
    // Optionally send a logging message through MCP protocol
    try {
      if (this.server.sendLoggingMessage) {
        this.server.sendLoggingMessage({
          level: 'info',
          data: 'MCP Observability Server ready for operation'
        }).catch(() => {
          // Silently handle logging errors to avoid noise
        });
      }
    } catch (error) {
      // Silently handle if sendLoggingMessage is not available
    }
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

    // Log server lifecycle status periodically
    setInterval(() => {
      if (this.server.transport && this.server.transport.readyState === 'open') {
        console.error('[MOS] Status - Active and processing requests');
      }
    }, 60000); // Every 60 seconds
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


  async handleGetMonitoringContext(args) {
    const { include_health = true, include_session_stats = true } = args;
    const sessionId = args.session_id || this.generateSessionId();
    
    // This tool is designed to be called automatically by Claude 
    // and will inject live monitoring information into responses
    
    const contextLines = [
      '🎯 MOS Live Monitoring Active',
      '',
      '🔧 Current Activity: Processing your request with real-time observability',
      '📡 MCP Integration: Dynamic monitoring injection enabled',
    ];
    
    if (include_session_stats) {
      const sessionStats = this.outputInjector.getSessionStats(sessionId);
      contextLines.push(`📊 ${sessionStats}`);
    }
    
    if (include_health) {
      const healthSummary = this.outputInjector.getSystemHealthSummary();
      if (healthSummary) {
        contextLines.push(healthSummary);
      }
    }
    
    contextLines.push('');
    contextLines.push('💡 This monitoring data appears automatically when MOS is active');
    
    return {
      content: [
        {
          type: 'text',
          text: contextLines.join('\n')
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


  async run() {
    // Auto-configure Claude Code if available
    console.error('[MOS] Starting MCP Observability Server...');
    
    try {
      const configured = await autoConfigureClaudeCode();
      if (configured) {
        console.error('[MOS] Claude Code auto-configuration completed');
      }
    } catch (error) {
      console.error('[MOS] Auto-configuration failed:', error.message);
    }

    const transport = new StdioServerTransport();
    
    // Add transport event logging
    transport.onclose = () => {
      console.error('[MOS] Connection closed');
    };
    
    transport.onerror = (error) => {
      console.error('[MOS] Connection error:', error);
    };

    // Log connection attempt
    console.error('[MOS] Connecting to transport...');
    
    await this.server.connect(transport);
    
    // Connection established
    console.error('[MOS] Transport connection established');
    console.error('[MOS] mos listening on stdio');
  }
}

// Start the server
const server = new ObservabilityServer();
server.run().catch(console.error);