# MCP Observability Server - Revised Specification
*Real-time Claude Code activity monitoring with native output integration*

## I. Core Goal
Provide real-time visibility into Claude Code activities (tasks, tools, MCP calls, subagents) using Claude Code hooks with native Claude Code output styling.

## II. Activity Coverage

### Complete Event Types
- **Tasks**: `task_started`, `task_progress`, `task_complete`, `task_failed`
- **Tools**: `tool_pre_call`, `tool_post_call`, `tool_error`
- **MCP Calls**: `mcp_request`, `mcp_response`, `mcp_error` *(ADDED)*
- **Subagents**: `subagent_spawn`, `subagent_complete`, `subagent_failed`

## III. Claude Code Output Style Integration

### Output Formatting
Matches Claude Code's native console output:
```
🔄 Task: Implementing user authentication
  ├─ 📁 Reading src/auth.js (245ms) ✅
  ├─ 🔧 Tool: edit_file (1.2s) ✅
  ├─ 📡 MCP: database_query → users table (890ms) ✅
  ├─ 🤖 Subagent: security_review (3.4s) ✅
  └─ ✅ Task completed (8.2s total)

⚠️  Slow operation detected: database_query (890ms > 500ms threshold)
```

### Visual Indicators
- **Progress**: Spinning indicators for active operations
- **Status Colors**: Green (✅), Red (❌), Yellow (⚠️), Blue (🔄)
- **Hierarchy**: Tree-style indentation for task relationships
- **Timing**: Duration display for completed operations

## IV. Enhanced Event Schema

```json
{
  "timestamp": "2025-08-26T10:05:00Z",
  "session_id": "sess-123",
  "event_type": "task_started|tool_pre_call|mcp_request|subagent_spawn|...",
  "status": "started|running|success|error|timeout",
  "duration_ms": 1250,
  "parent_id": "task-456",
  "correlation_id": "trace-789",
  "details": {
    "name": "edit_file",
    "description": "Editing user auth logic",
    "input_summary": "file: src/auth.js, lines: 45-67",
    "output_summary": "Added JWT validation",
    "error_message": "File not found",
    "resource_usage": {
      "memory_mb": 15,
      "cpu_percent": 2.1
    }
  },
  "display_info": {
    "icon": "📁",
    "color": "green",
    "indent_level": 2,
    "should_collapse": false
  }
}
```

## V. MCP Methods

### 1. Stream Live Activity *(Enhanced)*
```json
{
  "method": "stream_activity",
  "params": {
    "session_id": "sess-123",
    "output_format": "claude_code_style",
    "show_progress": true,
    "collapse_completed": false
  }
}

// Response: Real-time formatted output stream
{
  "activity_update": {
    "formatted_line": "  ├─ 🔧 Tool: edit_file (running...) 🔄",
    "raw_event": { /* event object */ },
    "display_action": "append|update|replace",
    "line_id": "task-456-tool-edit"
  }
}
```

### 2. Get Activity Tree *(New)*
```json
{
  "method": "get_activity_tree",
  "params": {
    "session_id": "sess-123",
    "include_completed": true,
    "max_depth": 5
  }
}

// Response: Hierarchical view of all activities
{
  "activity_tree": {
    "root_task": {
      "id": "task-456",
      "name": "Implementing user auth",
      "status": "running",
      "children": [
        {
          "type": "tool_call",
          "name": "edit_file",
          "status": "completed",
          "duration_ms": 1200
        },
        {
          "type": "subagent",
          "name": "security_review", 
          "status": "running",
          "children": [ /* nested activities */ ]
        }
      ]
    }
  }
}
```

### 3. Configure Display *(New)*
```json
{
  "method": "configure_display",
  "params": {
    "session_id": "sess-123",
    "settings": {
      "show_timings": true,
      "collapse_fast_ops": true,
      "threshold_slow_ms": 500,
      "max_tree_depth": 3,
      "highlight_errors": true
    }
  }
}
```

### 4. Export Session *(New)*
```json
{
  "method": "export_session",
  "params": {
    "session_id": "sess-123",
    "format": "claude_code_log|json|text"
  }
}
```

## VI. Claude Code Hook Integration

### Hook Registration
```javascript
// Claude Code settings.json
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

### Hook Implementation
- **Non-blocking**: Hooks don't delay Claude Code operations
- **Fallback**: Continue if observability server unavailable
- **Batching**: Group rapid events to prevent spam
- **Context**: Include current task context in each event

## VII. Real-time Display Integration

### Live Console Output
```bash
# Claude Code console shows integrated activity
user: Implement user authentication

🔄 Task: Implementing user authentication
  ├─ 📁 Reading src/auth.js (245ms) ✅
  ├─ 🔧 Editing authentication logic... 🔄
  │   └─ 📡 MCP: syntax_check (125ms) ✅  
  ├─ 🤖 Spawning security_review subagent... 🔄
  └─ ...continuing

# Real-time updates without cluttering main output
```

### Progress Indicators
- **Active Operations**: Spinning indicators (🔄) for running tasks
- **Quick Operations**: Brief flash for fast completions
- **Slow Operations**: Persistent timing display
- **Errors**: Red highlighting with expandable details

## VIII. Session Management

### Session Lifecycle
```json
{
  "session": {
    "id": "sess-123",
    "start_time": "2025-08-26T10:00:00Z",
    "status": "active|paused|completed|failed",
    "root_task": "Implementing user auth",
    "active_operations": [
      {
        "type": "subagent",
        "name": "security_review",
        "started": "2025-08-26T10:05:00Z"
      }
    ],
    "metrics": {
      "total_tools_used": 15,
      "total_mcp_calls": 4,
      "total_duration_ms": 45000,
      "error_count": 1
    }
  }
}
```

### Cleanup & Persistence
- **Active Sessions**: Keep in memory for real-time updates
- **Completed Sessions**: Archive for 24 hours
- **Export**: Allow session data export before cleanup
- **Recovery**: Restore session state if server restarts

## IX. Implementation Architecture

### Core Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Claude Code    │───▶│  Event Capture  │───▶│  Display        │
│  Hooks          │    │  & Processing   │    │  Formatter      │ 
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Session Store  │◀───│  Activity Tree  │───▶│  Real-time      │
│  (Memory)       │    │  Builder        │    │  Stream         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Performance Requirements  
- **Event Processing**: <10ms latency per event
- **Display Updates**: <50ms for live console updates
- **Memory Usage**: <100MB for typical sessions
- **Throughput**: Handle 100+ events/second burst

## X. Success Criteria

### Functional Requirements
✅ **Complete Coverage**: All activity types (task/tool/MCP/subagent) monitored  
✅ **Real-time Display**: Live updates in Claude Code output style  
✅ **Non-intrusive**: No impact on Claude Code performance  
✅ **Hierarchical View**: Clear parent/child relationship visualization  

### User Experience  
✅ **Native Feel**: Looks like built-in Claude Code feature  
✅ **Actionable Info**: Easy to spot slow operations and errors  
✅ **Appropriate Detail**: Right level of information without clutter  
✅ **Session Continuity**: Maintain view across task lifecycle  

This revised specification directly addresses the audit findings and focuses on achieving the core goal of real-time Claude Code activity monitoring with native output integration.