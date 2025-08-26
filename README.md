# MCP Observability Server

Real-time Claude Code activity monitoring with native output integration.

## Features

- Real-time monitoring of tasks, tools, MCP calls, and subagents
- Claude Code native output styling
- Hierarchical activity tree visualization
- Session management and persistence
- Export capabilities

## Quick Start

```bash
npm install
npm start
```

## Configuration

Add to your Claude Code settings.json:

```json
{
  "hooks": {
    "mcp_observability": {
      "server": "mcp://observability-server",
      "events": {
        "task_start": "stream_activity",
        "tool_pre": "stream_activity", 
        "tool_post": "stream_activity",
        "mcp_request": "stream_activity",
        "subagent_spawn": "stream_activity"
      }
    }
  }
}
```

## API Methods

- `stream_activity` - Real-time activity monitoring
- `get_activity_tree` - Hierarchical activity view
- `configure_display` - Display settings
- `export_session` - Session data export

See the [specification](MCP_Observability_Server_Simple.md) for complete details.