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
# Add the observability MCP server
claude mcp add observability node src/server.js --cwd $(pwd)

# Verify it was added successfully
claude mcp list

# Check server status
claude mcp status observability
```

### 3. Test Integration
```bash
# Start Claude Code (MCP server loads automatically)
claude --version

# You should see auto-configuration messages:
# 🚀 Starting MCP Observability Server...
# 🔧 Auto-configuring Claude Code for observability...
# ✅ Claude Code auto-configuration completed
```

## 🎨 What Gets Auto-Configured

When the MCP server loads, it automatically:
- ✅ Sets `defaultOutputStyle` to "observability-default" 
- ✅ Installs colored activity logging hooks
- ✅ Creates performance monitoring hooks
- ✅ Sets up activity log at `~/.claude/observability.log`

## 📊 Expected Output

Once integrated, you'll see colored activity logs:

```bash
[14:32:15] 🔧 TOOL file_read - Started
[14:32:16] 🔧 TOOL file_read (245ms) - ✓ Completed
[14:32:22] ⚡ PERF ⚠️ Slow: database_query (5200ms > 5000ms)
[14:35:30] 📋 TASK analyze_codebase (3.5m) - ✓ Completed
```

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
```

### Check Server Status
```bash
claude mcp status observability
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

# Verify server status
claude mcp status observability

# Check Claude Code version
claude --version
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
# Check server process
ps aux | grep "mcp-observability-server"

# Test server standalone
node src/server.js

# Check working directory is correct
claude mcp status observability
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

- [ ] `claude mcp list` shows observability server
- [ ] `claude mcp status observability` shows "active"
- [ ] `claude --version` loads without errors
- [ ] `~/.claude/observability.log` gets created
- [ ] Activity logs appear when using Claude Code
- [ ] Colored output displays properly in terminal
- [ ] Performance alerts show for slow operations (>5s)

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify Claude Code version compatibility
3. Review server logs and error messages
4. Test with minimal configuration first

The MCP Observability Server provides real-time visibility into Claude Code operations with zero manual configuration required!