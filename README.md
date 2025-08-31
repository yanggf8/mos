# MOS (MCP Observability Server)

Real-time Claude Code activity monitoring with native output integration.

## 🎯 Overview

A lightweight MCP server that provides real-time visibility into Claude Code activities including tasks, tool calls, MCP requests, and subagent operations. Features native Claude Code output styling with hierarchical visualization.

## ✨ Features

- **Real-time Activity Monitoring** - Live streaming of all Claude Code operations
- **Native Output Styling** - Matches Claude Code's console formatting with tree visualization
- **Complete Event Coverage** - Tasks, tools, MCP calls, and subagents
- **Session Management** - Automatic lifecycle tracking with metrics and cleanup
- **Multiple Output Formats** - Claude Code style, JSON, and plain text
- **Hierarchical Visualization** - Parent-child relationship mapping
- **Configuration System** - Customizable display settings and thresholds
- **Export Capabilities** - Session data export in various formats

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add MCP server to Claude Code:**
   ```bash
   # Add the mos MCP server (run from project directory)
   claude mcp add mos node src/server.js
   
   # Verify it was added successfully
   claude mcp list
   # Should show: observability: node /path/to/mos/src/server.js - ✓ Connected
   ```

3. **Test integration:**
   ```bash
   # Test with debug output to see MCP server loading
   claude -p "What is 2+2?" --debug
   
   # You should see:
   # [ERROR] MCP server "observability" Server stderr: 🚀 Starting MCP Observability Server...
   # [ERROR] MCP server "observability" Server stderr: ✅ Claude Code auto-configuration completed
   # [DEBUG] MCP server "observability": Successfully connected to stdio server
   ```

4. **Or run standalone demo:**
   ```bash
   node examples/demo.js
   ```

5. **Build and validate:**
   ```bash
   npm run build
   ```

6. **Run tests:**
   ```bash
   npm test
   ```

## 📋 Example Output

```
🔄 Task: Implementing user authentication
  ├─ 📁 Reading src/auth.js (245ms) ✅
  ├─ 🔧 Tool: edit_file (1.2s) ✅
  ├─ 📡 MCP: database_query → users table (890ms) ✅
  ├─ 🤖 Subagent: security_review (3.4s) ✅
  └─ ✅ Task completed (8.2s total)

⚠️  Slow operation detected: database_query (890ms > 500ms threshold)
```

## ⚙️ Claude Code Integration

### Automatic Setup (Recommended)
The MCP server automatically configures Claude Code when it loads:
- Installs colored activity logging hooks
- Sets mos-focused output style  
- Creates activity log at `~/.claude/logs/mos.log`

### Manual Setup
Add MCP server using Claude CLI:

```bash
# Add the mos MCP server (from project directory)
claude mcp add mos node src/server.js

# Verify successful registration
claude mcp get mos
```

### Verify Integration
```bash
# List all configured MCP servers
claude mcp list

# Check mos server details
claude mcp get mos
# Status: ✓ Connected
# Command: node src/server.js

# Test with debug output
claude -p "Hello world" --debug | grep mos
```

### What You'll See
When MCP server loads successfully:
```bash
🚀 Starting MCP Observability Server...
✅ Claude Code mos auto-configuration completed  
📊 mos listening on stdio
```

Once integrated, Claude Code provides:
- **Real-time activity monitoring** via MCP protocol
- **Colored activity logging** (auto-configured hooks)
- **Performance monitoring** for slow operations (>5s)
- **Session tracking** with automatic cleanup
- **MOS-focused output style** applied automatically

## 🛠️ API Methods

### Core Methods
- **`stream_activity`** - Real-time activity monitoring with live updates
- **`get_activity_tree`** - Hierarchical view of session activities
- **`configure_display`** - Customize display settings and thresholds
- **`export_session`** - Export session data in multiple formats
- **`log_event`** - Log activity events (used by Claude Code hooks)

### Event Types Monitored
- **Tasks**: `task_started`, `task_complete`, `task_failed`
- **Tools**: `tool_pre_call`, `tool_post_call`, `tool_error`
- **MCP Calls**: `mcp_request`, `mcp_response`, `mcp_error`
- **Subagents**: `subagent_spawn`, `subagent_complete`, `subagent_failed`

## 📁 Project Structure

```
├── src/
│   ├── server.js           # Main MCP server
│   ├── session-manager.js  # Session lifecycle management
│   ├── activity-streamer.js # Real-time streaming
│   ├── formatter.js        # Claude Code output formatting
│   └── types.js           # Event schema and utilities
├── examples/
│   ├── demo.js            # Working demonstration
│   └── claude-code-hooks.js # Hook integration example
├── test/
│   └── server.test.js     # Comprehensive test suite
└── docs/
    ├── README.md          # This file
    ├── USAGE.md          # Detailed usage guide
    └── *.md              # Technical specifications
```

## 📊 Performance

- **Memory Usage**: ~100MB for typical sessions
- **Event Processing**: <10ms latency per event
- **Display Updates**: <50ms for live console updates
- **Throughput**: 100+ events/second sustained
- **Storage**: In-memory with configurable limits (1000 events/session)

## 🧪 Testing

The project includes comprehensive tests covering:
- Event schema validation
- Session management lifecycle  
- Activity tree building
- Real-time streaming
- Output formatting
- Performance and memory usage
- Error handling and retry logic

Build and test with:
```bash
npm install     # Install dependencies first
npm run build   # Validate syntax and code
npm test        # Run test suite

# For test environment (no background timers)
NODE_ENV=test npm test
```

All tests pass with Node.js 18+ and validate core functionality including:
- High-volume event processing (2000+ events)
- Concurrent stream handling (10+ concurrent streams)
- Memory management and session cleanup
- Error recovery with exponential backoff
- End-to-end performance validation

The demo can be run with:
```bash
node examples/demo.js
```

## 📖 Documentation

- **[USAGE.md](USAGE.md)** - Complete usage guide with examples
- **[MCP_Observability_Server_Simple.md](MCP_Observability_Server_Simple.md)** - Final specification
- **[examples/](examples/)** - Working code examples and demonstrations

## 🔧 Configuration Options

- `maxEventsPerSession`: Maximum events per session (default: 1000)
- `sessionTimeoutMs`: Session timeout (default: 24 hours)
- `slowThresholdMs`: Slow operation threshold (default: 500ms)
- `bufferSize`: Event buffer for replay (default: 100)

## 🎯 Use Cases

- **Development Monitoring** - Track Claude Code task execution in real-time
- **Performance Analysis** - Identify slow operations and bottlenecks
- **Debugging** - Trace complex task hierarchies and tool interactions
- **Session Export** - Archive task execution for analysis or reporting
- **Integration Testing** - Monitor MCP server interactions and subagent behavior

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite (`npm test`)
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built for Claude Code** - Enhancing observability and debugging experience for AI-powered development workflows.