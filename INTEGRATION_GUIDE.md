# MCP Observability Server - Integration Guide

Complete guide for integrating the MCP Observability Server with Claude Code.

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
cd mcp-observability-server
npm install
```

### 2. Add MCP Server to Claude Code
```bash
# Add the observability MCP server (run from project directory)
claude mcp add observability node src/server.js

# Verify it was added successfully
claude mcp list
# Should show: observability: node /path/to/mos/src/server.js - ✓ Connected

# Get detailed server information
claude mcp get observability
```

### 3. Test Integration
```bash
# Test with debug output to confirm MCP server loading
claude -p "Test message" --debug 2>&1 | head -20

# You should see in the output:
# 🚀 Starting MCP Observability Server...
# ✅ Claude Code auto-configuration completed
# 📊 MCP Observability Server running on stdio
# [DEBUG] MCP server "observability": Successfully connected to stdio server
```

## 🎨 What Gets Auto-Configured

When the MCP server loads, it automatically:
- ✅ Sets `defaultOutputStyle` to "observability-default" 
- ✅ Installs colored activity logging hooks
- ✅ Creates performance monitoring hooks
- ✅ Sets up activity log at `~/.claude/observability.log`

## 📊 Expected Output

### Server Startup (in debug mode)
```bash
🚀 Starting MCP Observability Server...
✅ Claude Code auto-configuration completed  
📊 MCP Observability Server running on stdio
[DEBUG] MCP server "observability": Successfully connected to stdio server in 2338ms
```

### Integration Confirmed
When `claude mcp list` shows:
```bash
observability: node /home/user/mos/src/server.js - ✓ Connected
```

### Features Available
- **Real-time activity monitoring** via MCP protocol
- **Colored activity logging** (auto-configured hooks) 
- **Performance monitoring** for slow operations
- **Session tracking** with automatic cleanup

### Activity Types & Colors
- **🔧 TOOL** (Blue) - File operations, API calls
- **📋 TASK** (Green) - Multi-step workflows
- **🔗 MCP** (Cyan) - Protocol communication
- **🤖 AGENT** (Magenta) - Subagent activity
- **⚡ PERF** (Yellow) - Performance alerts
- **❌ ERROR** (Red) - Error conditions

## 🔧 Management Commands

### List MCP Servers
```bash
claude mcp list
# observability: node /path/to/mos/src/server.js - ✓ Connected
```

### Check Server Details
```bash
claude mcp get observability
# Status: ✓ Connected
# Type: stdio  
# Command: node src/server.js
```

### Enable/Disable Server
```bash
claude mcp enable observability   # Enable if disabled
claude mcp disable observability  # Temporarily disable
```

### Remove Server
```bash
claude mcp remove observability   # Completely remove
```

### View Activity Log
```bash
tail -f ~/.claude/observability.log
```

## 🐛 Troubleshooting

### Server Not Starting
```bash
# Check if server was added correctly
claude mcp list

# Get detailed server information
claude mcp get observability

# Test with debug output
claude -p "Test" --debug | grep observability
```

### No Activity Logs
```bash
# Check if observability.log exists
ls -la ~/.claude/observability.log

# Test with a simple command
claude --help

# Check hook configuration
cat ~/.claude/settings.json | grep -A 10 "hooks"
```

### MCP Server Connection Issues
```bash
# Check if server is registered
claude mcp get observability

# Test server startup manually
node src/server.js
# Should show: 🚀 Starting MCP Observability Server...

# Remove and re-add if needed
claude mcp remove observability
claude mcp add observability node src/server.js
```

### Auto-Configuration Not Working
The auto-configuration runs when the MCP server starts. If it fails:

```bash
# Check Claude Code directory exists
ls ~/.claude/

# Test auto-configuration manually
node -e "
import('./src/claude-code-auto-config.js').then(module => {
  module.autoConfigureClaudeCode().then(console.log);
});
"
```

## 📝 Manual Configuration

If auto-configuration doesn't work, you can manually add hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "observability_basic_activity": {
      "command": ["sh", "-c", "echo \"[$(date +'%H:%M:%S')] \\033[94m🔧 TOOL\\033[0m $TOOL_NAME - \\033[96mStarted\\033[0m\" | tee -a ~/.claude/observability.log"],
      "matchers": [
        {"events": ["PreToolUse"], "description": "Colored activity logging"}
      ]
    }
  }
}
```

## 🔄 Updating

### Update MCP Server
```bash
# Pull latest changes
git pull

# Reinstall dependencies
npm install

# No need to re-add to Claude Code - existing registration remains
```

### Reset Configuration
```bash
# Remove and re-add MCP server
claude mcp remove observability
claude mcp add observability node src/server.js --cwd $(pwd)
```

## 📚 Advanced Usage

### Custom Hook Configuration
See `examples/claude-code-hooks-config-colored.json` for advanced colored hook configurations.

### Multiple Output Styles
```bash
# Try different output styles
/output-style observability-focused
/output-style monitoring-companion
```

### Performance Monitoring
Adjust performance thresholds by editing the auto-configuration in `src/claude-code-auto-config.js`.

## ✅ Verification Checklist

- [ ] `claude mcp add observability node src/server.js` succeeds
- [ ] `claude mcp list` shows observability server as "✓ Connected"
- [ ] `claude mcp get observability` shows "Status: ✓ Connected" 
- [ ] `claude -p "Test" --debug` shows MCP server startup messages
- [ ] Debug output includes "✅ Claude Code auto-configuration completed"
- [ ] Auto-configuration applies observability settings
- [ ] Real-time activity monitoring works via MCP protocol

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify Claude Code version compatibility
3. Review server logs and error messages
4. Test with minimal configuration first

The MCP Observability Server provides real-time visibility into Claude Code operations with zero manual configuration required!