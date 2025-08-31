# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **MCP Observability Server (mos)** - a real-time Claude Code activity monitoring server that implements the Model Context Protocol (MCP). It provides live streaming of Claude Code operations including tasks, tool calls, MCP requests, and subagent activities with native Claude Code output styling.

The project is a Node.js ES module MCP server that integrates with Claude Code to provide observability into AI development workflows.

## Development Commands

### Core Commands
```bash
# Install dependencies
npm install

# Start the server (production mode)
npm start

# Development mode with file watching
npm run dev

# Build validation (syntax and code check)
npm run build

# Run test suite
npm test

# Run tests in clean environment (no background timers)
NODE_ENV=test npm test

# Run performance tests specifically  
NODE_ENV=test node --test test/performance.test.js
```

### Testing
- Main test suite: `test/server.test.js` - comprehensive functionality tests
- Performance tests: `test/performance.test.js` - load and memory testing
- Demo script: `node examples/demo.js` - working demonstration
- All tests use Node.js native test runner (`node:test`)

## Architecture

### Core Components

**MCP Server (`src/server.js`)**
- Main entry point implementing MCP protocol via `@modelcontextprotocol/sdk`
- Registers 6 tools: `stream_activity`, `get_activity_tree`, `configure_display`, `export_session`, `log_event`, `get_health_status`
- Handles lifecycle events and auto-configuration
- Uses stdio transport for Claude Code integration

**Session Management (`src/session-manager.js`)**
- Manages session lifecycle with automatic cleanup (24h timeout)
- Stores events in-memory with configurable limits (1000 events/session)
- Builds hierarchical activity trees from flat event streams
- Provides session statistics and metrics

**Activity Streaming (`src/activity-streamer.js`)**
- Real-time event broadcasting to active streams
- Supports multiple output formats (claude_code_style, json, plain)
- Manages stream lifecycle with cleanup mechanisms

**Event System (`src/types.js`)**
- Defines event schema and validation
- Event types: TASK, TOOL, MCP, SUBAGENT with status tracking
- Session and event creation utilities

**Health Monitoring (`src/health-monitor.js`)**
- Performance metrics collection
- Circuit breaker pattern implementation
- Alert system for degraded performance

**Error Handling (`src/error-handler.js`)**
- Centralized error handling with retry logic
- Circuit breaker integration
- Tool-specific error wrapping

**Output Formatting (`src/formatter.js`, `src/claude-code-formatter.js`)**
- Native Claude Code styling with tree visualization
- Activity tree rendering with timing and status
- Multiple export format support

### Integration Architecture

**Auto-Configuration (`src/claude-code-auto-config.js`)**
- Automatically configures Claude Code hooks on server startup
- Installs activity logging hooks and output styling
- Creates mos activity log at `~/.claude/logs/mos.log`

**Claude Code Integration**
- MCP server registration via `claude mcp add mos node src/server.js`
- Hook-based event collection from Claude Code operations  
- Real-time activity streaming during development sessions

## Key Features

- **Real-time Monitoring**: Live streaming of all Claude Code activities
- **Hierarchical Visualization**: Parent-child relationship mapping in tree format
- **Native Output Styling**: Matches Claude Code console formatting
- **Session Management**: Automatic lifecycle tracking with cleanup
- **Multiple Export Formats**: JSON, text, and Claude Code log formats
- **Performance Monitoring**: Slow operation detection with configurable thresholds
- **Error Recovery**: Circuit breaker and retry mechanisms

## Configuration

**MCP Configuration (`mcp-config.json`)**
- Server name: "mos" 
- Command: `node src/server.js`
- Environment: production mode
- Working directory: current directory

**Default Settings**
- Max events per session: 1000
- Session timeout: 24 hours
- Slow operation threshold: 500ms
- Event buffer size: 100

## Event Types Monitored

- **Tasks**: `task_started`, `task_complete`, `task_failed`
- **Tools**: `tool_pre_call`, `tool_post_call`, `tool_error`
- **MCP Calls**: `mcp_request`, `mcp_response`, `mcp_error` 
- **Subagents**: `subagent_spawn`, `subagent_complete`, `subagent_failed`

## Performance Characteristics

- Memory usage: ~100MB for typical sessions
- Event processing latency: <10ms per event
- Display update latency: <50ms for live console updates
- Throughput: 100+ events/second sustained
- In-memory storage with configurable session limits

## Common Development Workflows

**Adding the MCP server to Claude Code:**
```bash
# From project directory
claude mcp add mos node src/server.js

# Verify installation
claude mcp list
# Should show: mos: node /path/to/mos/src/server.js - ✓ Connected
```

**Testing integration:**
```bash
# Test with debug output
claude -p "What is 2+2?" --debug

# Look for startup messages:
# [MOS] Starting MCP Observability Server...
# [MOS] Claude Code auto-configuration completed
```

**Running standalone demo:**
```bash
node examples/demo.js
```