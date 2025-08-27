# Activity Color Scheme

Complete color scheme for MCP Observability Server activity types and status indicators.

## 🎨 Activity Type Colors

| Activity | Color | Icon | Description | Usage |
|----------|-------|------|-------------|-------|
| **TOOL** | 🔵 Blue | 🔧 | Tool execution and operations | File operations, API calls, system commands |
| **TASK** | 🟢 Green | 📋 | Task management and workflows | User tasks, multi-step operations |
| **MCP** | 🔵 Cyan | 🔗 | MCP protocol communication | Server requests, responses, protocol events |
| **AGENT** | 🟣 Magenta | 🤖 | Agent and subagent activity | Agent spawning, completion, delegation |
| **PERF** | 🟡 Yellow | ⚡ | Performance monitoring | Slow operations, timing alerts |
| **ERROR** | 🔴 Red | ❌ | Error conditions | Failures, exceptions, critical issues |
| **HEALTH** | 💚 Green | ❤️ | System health monitoring | Health checks, status updates |
| **SESSION** | ⚪ White | 📊 | Session management | Session start/end, summaries |
| **EVENT** | ⚫ Gray | 📋 | Generic events | Miscellaneous activities |

## 📊 Status Colors

| Status | Color | Example Usage |
|--------|-------|---------------|
| **Success** | 🟢 Green | `✓ Completed`, `✓ Success` |
| **Started** | 🔵 Blue | `Started`, `Running`, `Active` |
| **Warning** | 🟡 Yellow | `⚠️ Slow`, `⚠️ Warning` |
| **Error** | 🔴 Red | `✗ Failed`, `✗ Error` |
| **Pending** | ⚪ White | `Pending`, `Idle` |

## ⏱️ Performance Timing Colors

| Duration | Color | Visual Indicator |
|----------|-------|------------------|
| **< 100ms** | 🟢 Green | Very fast operations |
| **100-500ms** | 💚 Bright Green | Fast operations |
| **500ms-1s** | 🔵 Blue | Normal operations |
| **1-2s** | 🔵 Cyan | Moderate operations |
| **2-5s** | 🟡 Yellow | Slow operations |
| **5-10s** | 🟠 Bright Yellow | Very slow operations |
| **> 10s** | 🔴 Red | Extremely slow operations |

## 🖥️ Terminal Output Examples

### Tool Activity
```bash
[14:32:15] 🔧 TOOL file_read - Started
[14:32:16] 🔧 TOOL file_read (245ms) - ✓ Completed
```

### Task Management  
```bash
[14:32:17] 📋 TASK analyze_codebase - Started
[14:32:45] 📋 TASK analyze_codebase (28.3s) - ✓ Completed
```

### MCP Communication
```bash
[14:32:18] 🔗 MCP get_health_status - Request sent
[14:32:18] 🔗 MCP get_health_status (156ms) - Response received
```

### Agent Activity
```bash
[14:32:20] 🤖 AGENT general-purpose - Spawned
[14:32:35] 🤖 AGENT general-purpose (15.2s) - ✓ Completed
```

### Performance Alerts
```bash
[14:32:22] ⚡ PERF ⚠️ Slow: database_query (5200ms > 5000ms threshold)
[14:32:30] ⚡ PERF ⚠️ Very Slow: image_processing (12.8s > 10s threshold)
```

### Error Conditions
```bash
[14:32:25] ❌ ERROR Tool error: file_write - Permission denied
[14:32:26] ❌ ERROR Network timeout: api_request (30s)
```

### System Health
```bash
[14:32:00] ❤️ HEALTH System status: healthy
[14:33:00] ⚠️ HEALTH System status: warning (high memory usage)
```

### Session Management
```bash
[14:32:00] 📊 SESSION user-session-123 - Started
[14:35:30] 📊 SESSION user-session-123 (3.5m) - ✓ Completed - 15 tools used
```

## 🎯 Usage in Different Contexts

### 1. Claude Code Hooks
Uses emoji icons with colored ANSI codes for terminal display:
- Colored activity types: `🔧 TOOL`, `📋 TASK`, `🔗 MCP`, `🤖 AGENT`
- Status indicators: `✓ Completed`, `✗ Failed`, `⚠️ Slow`
- Timing colors based on duration thresholds

### 2. Console/Terminal Output
Full ANSI color support with:
- Colored text for activity types and status
- Progressive color intensity for timing (green → yellow → red)
- Dimmed timestamps for better focus on content

### 3. Log Files
Plain text with emoji icons (colors stripped):
- Maintains readability in log viewers
- Preserves visual hierarchy through icons
- Compatible with log analysis tools

### 4. Web Interface (Future)
CSS class-based styling:
- `activity-tool`, `activity-task`, `status-success`, etc.
- Consistent visual language across all interfaces
- Accessibility-compliant color choices

## 🔧 Technical Implementation

### ANSI Color Codes
```javascript
const ANSI_COLORS = {
  blue: '\x1b[94m',      // Tool operations
  green: '\x1b[92m',     // Task management, success
  cyan: '\x1b[96m',      // MCP communication
  magenta: '\x1b[95m',   // Agent operations
  yellow: '\x1b[93m',    // Performance warnings
  red: '\x1b[91m',       // Errors
  white: '\x1b[97m',     // Session management
  reset: '\x1b[0m'       // Reset formatting
};
```

### Hook Configuration Example
```bash
# Colored tool activity logging
"command": ["sh", "-c", "echo \"[$(date +'%H:%M:%S')] \\033[94m🔧 TOOL\\033[0m $TOOL_NAME - \\033[96mStarted\\033[0m\""]
```

### Performance-Based Color Selection
```javascript
function getTimingColor(durationMs) {
  if (durationMs < 100) return ANSI_COLORS.green;      // Very fast
  if (durationMs < 500) return ANSI_COLORS.brightGreen; // Fast
  if (durationMs < 1000) return ANSI_COLORS.blue;      // Normal
  if (durationMs < 2000) return ANSI_COLORS.cyan;      // Moderate
  if (durationMs < 5000) return ANSI_COLORS.yellow;    // Slow
  if (durationMs < 10000) return ANSI_COLORS.brightYellow; // Very slow
  return ANSI_COLORS.red;                               // Extremely slow
}
```

## 🎨 Design Principles

1. **Semantic Consistency**: Each activity type has a consistent color across all contexts
2. **Performance Awareness**: Colors progressively indicate performance impact
3. **Accessibility**: High contrast ratios and alternative text indicators
4. **Cross-Platform**: Compatible with terminals, logs, and web interfaces
5. **Visual Hierarchy**: Important events (errors, slow operations) use attention-grabbing colors
6. **Professional Appearance**: Balanced color palette suitable for development environments

## 🔄 Customization

Colors can be customized through the `COLOR_SCHEMES` configuration:
- Terminal schemes for console output
- Claude Code schemes for hook integration  
- HTML schemes for web interfaces
- Custom schemes for specific environments

This comprehensive color system provides immediate visual feedback about system activity, performance, and health status across all MCP Observability Server interfaces.