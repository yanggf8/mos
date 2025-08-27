/**
 * Auto-configuration for Claude Code when MCP Observability Server loads
 * Automatically applies observability-friendly settings and styles
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Auto-configure Claude Code when MCP server starts
 */
export class ClaudeCodeAutoConfig {
  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.settingsFile = path.join(this.claudeDir, 'settings.json');
    this.outputStylesDir = path.join(this.claudeDir, 'output-styles');
  }

  /**
   * Apply default observability configuration when server starts
   */
  async applyDefaultConfiguration() {
    console.log('🔧 Auto-configuring Claude Code for observability...');

    try {
      // 1. Ensure output styles are available
      await this.ensureOutputStyles();

      // 2. Apply default observability style
      await this.setDefaultOutputStyle();

      // 3. Configure basic hooks if not present
      await this.ensureBasicHooks();

      console.log('✅ Claude Code auto-configuration completed');
      return true;
    } catch (error) {
      console.warn('⚠️  Could not auto-configure Claude Code:', error.message);
      return false;
    }
  }

  /**
   * Ensure observability output styles are installed
   */
  async ensureOutputStyles() {
    const stylesDir = this.outputStylesDir;
    
    if (!existsSync(stylesDir)) {
      return; // Claude Code not installed or configured
    }

    const observabilityStyle = path.join(stylesDir, 'observability-default.md');
    
    if (!existsSync(observabilityStyle)) {
      // Create default observability style
      const styleContent = this.createDefaultObservabilityStyle();
      writeFileSync(observabilityStyle, styleContent);
      console.log('📝 Created default observability output style');
    }
  }

  /**
   * Set default output style to observability-focused
   */
  async setDefaultOutputStyle() {
    try {
      // Use Claude Code CLI to set default style
      execSync('claude config set output-style observability-default', { 
        stdio: 'ignore',
        timeout: 5000 
      });
      console.log('🎨 Applied default observability output style');
    } catch (error) {
      // Fallback: modify settings.json directly
      await this.setOutputStyleInSettings();
    }
  }

  /**
   * Fallback: set output style in settings.json
   */
  async setOutputStyleInSettings() {
    if (!existsSync(this.settingsFile)) {
      return;
    }

    try {
      const settings = JSON.parse(readFileSync(this.settingsFile, 'utf8'));
      settings.defaultOutputStyle = 'observability-default';
      writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
      console.log('📝 Updated default output style in settings.json');
    } catch (error) {
      console.warn('Could not update settings.json:', error.message);
    }
  }

  /**
   * Ensure basic observability hooks are present
   */
  async ensureBasicHooks() {
    if (!existsSync(this.settingsFile)) {
      return;
    }

    try {
      const settings = JSON.parse(readFileSync(this.settingsFile, 'utf8'));
      
      // Only add hooks if none exist
      if (!settings.hooks || Object.keys(settings.hooks).length === 0) {
        settings.hooks = this.createBasicObservabilityHooks();
        writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
        console.log('🔗 Added basic observability hooks');
      }
    } catch (error) {
      console.warn('Could not add hooks:', error.message);
    }
  }

  /**
   * Create default observability style content
   */
  createDefaultObservabilityStyle() {
    return `---
name: "Observability Default"
description: "Auto-applied observability style when MCP server is active"
version: "1.0.0"
---

# Default Observability Style

You are working with an active MCP Observability Server that monitors your tool usage and performance. 

## Behavior Changes

When you notice tool operations or performance events:

1. **Acknowledge Slow Operations**: If you see performance alerts like:
   \`[14:32:22] PERF ⚠️ Slow: database_query (5200ms > 5000ms)\`
   
   Briefly acknowledge: "I notice that database query was slow (5.2s). Let me..."

2. **Reference Activity Context**: When relevant, mention observed activity:
   "Based on the file operations I just performed..."
   "Given the tool execution times I'm seeing..."

3. **Suggest Performance Monitoring**: For complex operations, occasionally suggest:
   "Consider monitoring this operation's performance in production"
   "This might benefit from performance tracking"

## Style Guidelines

- **Natural Integration**: Don't over-emphasize observability unless relevant
- **Performance Awareness**: Note when operations seem slower than expected  
- **Context Sensitivity**: Reference activity data when it adds value
- **Actionable Insights**: Provide performance tips when appropriate

This style provides subtle observability awareness without changing your core helpfulness.`;
  }

  /**
   * Create basic observability hooks configuration
   */
  createBasicObservabilityHooks() {
    return {
      "observability_basic_activity": {
        "command": ["sh", "-c", "echo \"[$(date +'%H:%M:%S')] TOOL $TOOL_NAME - Started\" >> ~/.claude/observability.log"],
        "matchers": [
          {
            "events": ["PreToolUse"],
            "description": "Basic activity logging"
          }
        ]
      },
      "observability_basic_performance": {
        "command": ["sh", "-c", "if [ \"$TOOL_DURATION\" -gt 5000 ]; then echo \"[$(date +'%H:%M:%S')] PERF ⚠️ Slow: $TOOL_NAME (${TOOL_DURATION}ms)\"; fi"],
        "matchers": [
          {
            "events": ["PostToolUse"],
            "conditions": [
              {"field": "duration_ms", "operator": "greater_than", "value": 5000}
            ]
          }
        ]
      }
    };
  }

  /**
   * Check if Claude Code is available and configured
   */
  isClaudeCodeAvailable() {
    try {
      execSync('claude --version', { stdio: 'ignore', timeout: 2000 });
      return existsSync(this.claudeDir);
    } catch {
      return false;
    }
  }

  /**
   * Restore original Claude Code configuration
   */
  async restoreOriginalConfig() {
    console.log('🔄 Restoring original Claude Code configuration...');
    
    try {
      // Remove our default output style
      execSync('claude config unset output-style', { 
        stdio: 'ignore',
        timeout: 5000 
      });
      console.log('✅ Restored original output style');
    } catch (error) {
      console.warn('Could not restore output style:', error.message);
    }
  }
}

// Export convenience function
export async function autoConfigureClaudeCode() {
  const config = new ClaudeCodeAutoConfig();
  
  if (!config.isClaudeCodeAvailable()) {
    console.log('ℹ️  Claude Code not found - skipping auto-configuration');
    return false;
  }

  return await config.applyDefaultConfiguration();
}