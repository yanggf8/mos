# Claude Code Integration Guide

Complete guide for integrating the MCP Observability Server with Claude Code using hooks and statusline.

## 🎯 Overview

This integration provides real-time observability directly within Claude Code using:
- **Hooks** - Capture and display tool activity, performance alerts, and session events
- **Statusline** - Show live observability metrics in Claude Code's status bar
- **Native Output** - Display information using Claude Code's formatting style

## 🚀 Quick Setup

### 1. Start MCP Observability Server
```bash
cd /path/to/mcp-observability-server
npm start
```

### 2. Add Hooks to Claude Code Settings

Add to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "observability_activity": {
      "command": ["sh", "-c", "echo \"[$(date +'%H:%M:%S')] $TOOL_NAME - $TOOL_DESCRIPTION\" >> ~/.claude/observability.log"],
      "matchers": [
        {
          "events": ["PreToolUse", "PostToolUse"],
          "description": "Log tool activity"
        }
      ]
    },
    "observability_performance": {
      "command": ["sh", "-c", "if [ \"$TOOL_DURATION\" -gt 5000 ]; then echo \"⚠️  Slow: $TOOL_NAME (${TOOL_DURATION}ms)\"; fi"],
      "matchers": [
        {
          "events": ["PostToolUse"],
          "conditions": [
            {"field": "duration_ms", "operator": "greater_than", "value": 5000}
          ]
        }
      ]
    }
  },
  "statusline": {
    "script": "/path/to/mcp-observability-server/examples/statusline-observability.js"
  }
}
```

### 3. Make Statusline Script Executable
```bash
chmod +x examples/statusline-observability.js
```

## 📊 What You'll See

### In Claude Code Console
```
user: Help me debug this API issue

⚠️  Slow: database_query (5200ms)
[14:32:15] file_read - Reading API configuration
[14:32:16] ✓ file_read completed  
[14:32:18] edit_file - Updating error handling

assistant: I'll help you debug the API issue...
```

### In Statusline
```
claude-3-sonnet | myproject:main | 🟢obs | 85MB | 1s | $0.042
```

### In Activity Log (`~/.claude/observability.log`)
```
[14:30:15] file_read - Reading API configuration
[14:30:16] database_query - Querying user permissions  
[14:30:21] ⚠️  Slow operation: database_query (5200ms > 5000ms threshold)
[14:30:22] ✓ edit_file completed
```

## 🛠️ Configuration Options

### Hook Types Available

#### 1. **Activity Logging**
Logs all tool usage to file:
```json
{
  "observability_activity": {
    "command": ["sh", "-c", "echo \"[$(date +'%H:%M:%S')] $TOOL_NAME - $TOOL_DESCRIPTION\" >> ~/.claude/observability.log"],
    "matchers": [{"events": ["PreToolUse", "PostToolUse"]}]
  }
}
```

#### 2. **Performance Alerts** 
Shows warnings for slow operations:
```json
{
  "observability_performance": {
    "command": ["sh", "-c", "if [ \"$TOOL_DURATION\" -gt 5000 ]; then echo \"⚠️  Slow: $TOOL_NAME (${TOOL_DURATION}ms)\"; fi"],
    "matchers": [
      {
        "events": ["PostToolUse"],
        "conditions": [{"field": "duration_ms", "operator": "greater_than", "value": 5000}]
      }
    ]
  }
}
```

#### 3. **Error Notifications**
Highlights failed operations:
```json
{
  "observability_errors": {
    "command": ["sh", "-c", "echo \"❌ Error: $TOOL_NAME - $ERROR_MESSAGE\""],
    "matchers": [
      {
        "events": ["PostToolUse"], 
        "conditions": [{"field": "success", "operator": "equals", "value": false}]
      }
    ]
  }
}
```

#### 4. **Desktop Notifications** (macOS)
System notifications for critical events:
```json
{
  "observability_desktop": {
    "command": ["sh", "-c", "osascript -e 'display notification \"$TOOL_NAME took ${TOOL_DURATION}ms\" with title \"Claude Code Performance\"'"],
    "matchers": [
      {
        "events": ["PostToolUse"],
        "conditions": [{"field": "duration_ms", "operator": "greater_than", "value": 10000}]
      }
    ]
  }
}
```

#### 5. **MCP Server Integration**
Direct integration with observability server:
```json
{
  "observability_mcp": {
    "command": ["node", "-e", "
      const event = {
        session_id: process.env.CLAUDE_SESSION_ID,
        event_type: process.env.HOOK_EVENT === 'PreToolUse' ? 'tool_pre_call' : 'tool_post_call',
        status: process.env.TOOL_SUCCESS === 'true' ? 'success' : 'error',
        duration_ms: parseInt(process.env.TOOL_DURATION || '0'),
        details: { name: process.env.TOOL_NAME }
      };
      fetch('http://localhost:3000/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'log_event', params: { event } })
      }).catch(() => {});
    "],
    "matchers": [{"events": ["PreToolUse", "PostToolUse"]}]
  }
}
```

### Statusline Configuration

#### Basic Setup
```json
{
  "statusline": {
    "script": "/path/to/statusline-observability.js"
  }
}
```

#### Advanced Setup with Refresh Rate
```json
{
  "statusline": {
    "script": "/path/to/statusline-observability.js",
    "refresh_ms": 1000
  }
}
```

## 🎨 Customization

### Custom Hook Commands

Create your own hook commands for specific needs:

```bash
# Simple file logger
echo "[$(date)] Claude Code: $TOOL_NAME ($TOOL_DURATION ms)" >> ~/claude-activity.log

# JSON structured logging
echo "{\"timestamp\":\"$(date -Iseconds)\",\"tool\":\"$TOOL_NAME\",\"duration\":$TOOL_DURATION}" >> ~/claude-activity.ndjson

# Send to external monitoring (Slack, Discord, etc.)
curl -X POST https://hooks.slack.com/... -d "{\"text\":\"Claude Code: $TOOL_NAME completed in ${TOOL_DURATION}ms\"}"
```

### Custom Statusline Display

Modify `statusline-observability.js` to show:
- Different metrics (CPU, network, etc.)
- Custom formatting
- Additional MCP server data
- Integration with other tools

### Performance Thresholds

Adjust performance alert thresholds:
```json
{
  "conditions": [
    {"field": "duration_ms", "operator": "greater_than", "value": 3000}  // 3 seconds
  ]
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. **Hooks Not Firing**
```bash
# Check Claude Code configuration
claude doctor

# Verify hooks syntax
cat ~/.claude/settings.json | jq .hooks

# Test hook command manually
TOOL_NAME="test" TOOL_DURATION="1000" sh -c "echo \"Test: $TOOL_NAME ($TOOL_DURATION ms)\""
```

#### 2. **Statusline Not Updating**
```bash
# Test statusline script directly
node examples/statusline-observability.js

# Check if MCP server is running
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"method":"get_health_status","params":{}}'

# Enable debug mode
DEBUG=1 node examples/statusline-observability.js
```

#### 3. **MCP Server Connection Issues**
```bash
# Verify server is running
ps aux | grep "node.*server.js"

# Check logs
tail -f ~/.claude/observability.log

# Test MCP connectivity
curl -v http://localhost:3000/mcp
```

#### 4. **Permission Issues**
```bash
# Make scripts executable
chmod +x examples/statusline-observability.js

# Check file permissions for log files
ls -la ~/.claude/observability.log

# Fix permissions if needed
chmod 644 ~/.claude/observability.log
```

### Debug Mode

Enable detailed logging:
```bash
export DEBUG=1
export MCP_DEBUG=1
claude --verbose
```

## 📱 Platform-Specific Setup

### macOS
```bash
# Desktop notifications work out of the box
osascript -e 'display notification "Test" with title "Claude Code"'

# Statusline script needs to be executable
chmod +x examples/statusline-observability.js
```

### Linux
```bash
# Use notify-send for desktop notifications
notify-send "Claude Code" "Test notification"

# Install jq for JSON processing
sudo apt-get install jq  # Debian/Ubuntu
sudo yum install jq      # RHEL/CentOS
```

### Windows (WSL)
```bash
# Use Windows toast notifications
powershell.exe -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Test')"

# Ensure Node.js is available in PATH
which node
```

## 🚀 Advanced Integration

### Multiple MCP Servers

Monitor multiple MCP servers:
```json
{
  "observability_multi": {
    "command": ["node", "-e", "
      const servers = ['http://localhost:3000', 'http://localhost:3001'];
      Promise.all(servers.map(url => 
        fetch(url + '/mcp', {
          method: 'POST',
          body: JSON.stringify({method: 'log_event', params: {event: {...}}})
        }).catch(() => null)
      ));
    "],
    "matchers": [{"events": ["PreToolUse", "PostToolUse"]}]
  }
}
```

### External Integrations

Send data to external systems:
```bash
# Datadog
curl -X POST "https://api.datadoghq.com/api/v1/events" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -d "{\"title\":\"Claude Code Tool\",\"text\":\"$TOOL_NAME completed\",\"tags\":[\"claude:tool\"]}"

# Prometheus pushgateway
echo "claude_tool_duration_seconds $TOOL_DURATION" | curl --data-binary @- http://pushgateway:9091/metrics/job/claude_code
```

### Custom Analytics

Build custom analytics on top of the data:
```bash
# Daily summary
grep "$(date +'%Y-%m-%d')" ~/.claude/observability.log | wc -l

# Most used tools
grep -o 'Tool: [^-]*' ~/.claude/observability.log | sort | uniq -c | sort -nr

# Average duration by tool
awk '/Tool:/ && /completed/ {print $3, $5}' ~/.claude/observability.log | # ... process
```

## 📊 Example Outputs

### Console Integration
```
user: Help me optimize this database query

[14:32:15] database_query - Analyzing query performance
⚠️  Slow: database_query (8200ms)
[14:32:23] ✓ database_query completed
[14:32:24] edit_file - Updating query optimization

assistant: I've analyzed your database query and found several optimization opportunities...
```

### Statusline Examples
```bash
# Healthy system
claude-3-sonnet | myapp:feature/auth | 🟢obs | 67MB | 2s | $0.023

# Warning state  
claude-3-sonnet | myapp:main | 🟡obs | 234MB | 1s | 5%err | $0.156

# Critical state
claude-3-sonnet | myapp:bugfix | 🔴obs | 487MB | 3s | 12%err | $0.289

# Server unavailable
claude-3-sonnet | myapp:main | 🔴obs | $0.045
```

This integration provides comprehensive observability directly within Claude Code's interface, making it easy to monitor performance and activity without switching contexts.