#!/bin/bash

# MCP Observability Server - Claude Code Integration Setup
# This script helps users set up observability hooks and output styles in Claude Code

set -e

echo "🚀 MCP Observability Server - Claude Code Integration Setup"
echo "========================================================="

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code is not installed or not in PATH"
    echo "   Please install Claude Code first: https://claude.ai/code"
    exit 1
fi

echo "✅ Claude Code found"

# Create Claude directories if they don't exist
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR"
mkdir -p "$CLAUDE_DIR/output-styles"

echo "📁 Created Claude Code directories"

# Backup existing settings if they exist
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d-%H%M%S)"
    echo "💾 Backed up existing settings.json"
fi

# Function to merge JSON files
merge_settings() {
    if [ -f "$SETTINGS_FILE" ]; then
        # Merge with existing settings using jq
        if command -v jq &> /dev/null; then
            jq -s '.[0] * .[1]' "$SETTINGS_FILE" examples/claude-code-hooks-config.json > "$SETTINGS_FILE.tmp"
            mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
            echo "🔧 Merged hooks with existing settings"
        else
            echo "⚠️  jq not found - appending hooks to settings manually"
            echo "   Please manually merge examples/claude-code-hooks-config.json"
            echo "   into your ~/.claude/settings.json file"
        fi
    else
        # Create new settings file
        cp examples/claude-code-hooks-config.json "$SETTINGS_FILE"
        echo "📝 Created new settings.json with observability hooks"
    fi
}

# Copy output styles
echo "🎨 Installing custom output styles..."
cp examples/output-styles/*.md "$CLAUDE_DIR/output-styles/"
echo "   ✅ observability-focused.md"
echo "   ✅ monitoring-companion.md"

# Install hooks
echo "🔗 Installing observability hooks..."
merge_settings

# Make statusline script executable
STATUSLINE_SCRIPT="examples/statusline-observability.js"
if [ -f "$STATUSLINE_SCRIPT" ]; then
    chmod +x "$STATUSLINE_SCRIPT"
    STATUSLINE_PATH="$(pwd)/$STATUSLINE_SCRIPT"
    
    # Add statusline to settings
    if command -v jq &> /dev/null && [ -f "$SETTINGS_FILE" ]; then
        jq --arg path "$STATUSLINE_PATH" '. + {"statusline": {"script": $path}}' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
        mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
        echo "📊 Configured custom statusline: $STATUSLINE_PATH"
    else
        echo "📊 Statusline script ready at: $STATUSLINE_PATH"
        echo "   Add this to your settings.json manually:"
        echo "   {\"statusline\": {\"script\": \"$STATUSLINE_PATH\"}}"
    fi
fi

# Test MCP server connection
echo ""
echo "🧪 Testing MCP Observability Server connection..."
if curl -s -f -X POST http://localhost:3000/mcp \
   -H "Content-Type: application/json" \
   -d '{"method":"get_health_status","params":{}}' > /dev/null 2>&1; then
    echo "✅ MCP Observability Server is running and accessible"
else
    echo "⚠️  MCP Observability Server not running"
    echo "   Start it with: npm start"
fi

# Create observability log file
touch "$HOME/.claude/observability.log"
echo "📝 Created observability log file: ~/.claude/observability.log"

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "🎯 What's been installed:"
echo "   📋 Observability hooks in ~/.claude/settings.json"
echo "   🎨 Custom output styles in ~/.claude/output-styles/"
echo "   📊 Statusline script configured"
echo "   📝 Activity log at ~/.claude/observability.log"
echo ""
echo "🚀 Next steps:"
echo "   1. Add MCP server: claude mcp add observability node src/server.js --cwd \$(pwd)"
echo "   2. Verify setup: claude mcp list"
echo "   3. Start Claude Code - the MCP server loads automatically!"
echo "   4. Try the output styles: /output-style observability-focused"
echo ""
echo "📖 Example of what you'll see:"
echo "   [14:32:15] TOOL file_read - Starting execution"
echo "   [14:32:16] TOOL file_read (245ms) - ✓ Completed"
echo "   [14:32:17] PERF ⚠️ Slow: database_query (5200ms > 5000ms threshold)"
echo ""
echo "🔧 Troubleshooting:"
echo "   • View activity log: tail -f ~/.claude/observability.log"
echo "   • List MCP servers: claude mcp list"
echo "   • Check server status: claude mcp status observability"
echo "   • Test Claude Code: claude --version"
echo ""
echo "📚 Documentation: see CLAUDE_CODE_INTEGRATION.md for details"