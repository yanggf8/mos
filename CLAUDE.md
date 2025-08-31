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

**Dynamic MCP Integration (`src/mcp-output-injection.js`)**
- **No config file changes needed** - works instantly when MOS loads
- Injects monitoring context directly into MCP tool responses
- **Real-time Activity Display**: All MCP tool calls show live performance metrics
- **Session Tracking**: Automatic session statistics in every response

**Claude Code Integration**
- MCP server registration via `claude mcp add mos node src/server.js`
- **Dynamic Output Injection**: Live monitoring context added to all MCP responses
- **Instant Activation**: Works immediately when MOS MCP server starts
- **Live Activity Feedback**: Shows `🔧 MCP Tool: tool_name (45ms) ✅`, `📊 Session metrics`, `🖥️ System health`

## Key Features

- **Instant Dynamic Integration**: No config files needed - monitoring activates immediately when MOS loads
- **MCP Response Injection**: Live monitoring context automatically added to all MCP tool responses
- **Real-time Performance Display**: Shows `🔧 MCP Tool: tool_name (45ms) ✅` in every response
- **Session Tracking**: Automatic operation counts, success rates, and timing statistics
- **System Health Integration**: Live memory usage and server status in responses
- **Zero Configuration**: Works out-of-the-box when MCP server starts
- **Performance Indicators**: Automatic timing classification (`✅ Fast <500ms`, `🟡 Moderate`, `🔴 Slow >5s`)
- **Clean Deactivation**: Monitoring stops instantly when MOS server stops

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

All these events are automatically displayed in Claude Code responses when MOS is active:

- **Tasks**: `task_started`, `task_complete`, `task_failed` → `📋 TASK: Implementing authentication`
- **Tools**: `tool_pre_call`, `tool_post_call`, `tool_error` → `🔧 TOOL file_read - Reading config.js (45ms)`
- **MCP Calls**: `mcp_request`, `mcp_response`, `mcp_error` → `📊 MCP: Fetching session data`
- **Subagents**: `subagent_spawn`, `subagent_complete`, `subagent_failed` → `🤖 AGENT: Code analysis complete`

### Real-time Activity Display Examples

```
🎯 Implementing user authentication system...

🔧 TOOL file_read - Reading auth.js (45ms) ✅
📊 Performance: File read completed fast
🔧 TOOL edit_file - Updating authentication logic (230ms) ✅
🤖 AGENT code_reviewer - Analyzing security patterns (1.2s) 🟡

📈 Session Status: 4 operations completed, 100% success rate, avg 380ms
```

## Performance Characteristics

- Memory usage: ~100MB for typical sessions
- Event processing latency: <10ms per event
- Display update latency: <50ms for live console updates
- Throughput: 100+ events/second sustained
- In-memory storage with configurable session limits

## Installation and Setup

**One-time Installation:**
```bash
# From project directory
claude mcp add mos node src/server.js

# Verify installation
claude mcp list
# Should show: mos: node /path/to/mos/src/server.js - ✓ Connected
```

**Automatic Usage:**
```bash
# MOS now starts automatically with any Claude command
claude -p "implement user authentication"
claude  # Interactive mode
claude --help  # Any command triggers MOS startup

# No manual server starting needed - fully automatic!
```

**Testing integration:**
```bash
# MOS automatically starts when you run any Claude command
claude -p "What is 2+2?"

# You'll see startup messages in debug mode:
# [MOS] Starting MCP Observability Server...
# [MOS] 📡 Dynamic monitoring injection activated
# [MOS] MOS observability integration ready

# When Claude calls ANY MCP tool, responses show:
# 🔧 MCP Tool: some_tool (45ms) ✅
# 📊 MOS Status: Active monitoring  
# 📈 Session: 3 operations, 100% success rate
# 🖥️ MOS Health: 🟢 healthy, 12MB memory
```

**Running standalone demo:**
```bash
node examples/demo.js
```