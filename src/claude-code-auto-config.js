/**
 * Auto-configuration for Claude Code when MOS (MCP Observability Server) loads
 * Automatically applies mos-friendly settings and styles
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
   * Focus on MCP-based observability, not direct hooks
   */
  async applyDefaultConfiguration() {
    console.log('🔧 Auto-configuring Claude Code for mos...');

    try {
      // 1. Ensure output styles are available
      await this.ensureOutputStyles();

      // 2. Apply default mos style
      await this.setDefaultOutputStyle();

      // 3. Initialize mos (server handles monitoring via MCP tools)
      await this.initializeMCPObservability();

      console.log('✅ Claude Code mos auto-configuration completed');
      return true;
    } catch (error) {
      console.warn('⚠️  Could not auto-configure Claude Code:', error.message);
      return false;
    }
  }

  /**
   * Ensure mos output styles are installed
   */
  async ensureOutputStyles() {
    const stylesDir = this.outputStylesDir;
    
    if (!existsSync(stylesDir)) {
      return; // Claude Code not installed or configured
    }

    const mosStyle = path.join(stylesDir, 'mos-default.md');
    
    if (!existsSync(mosStyle)) {
      // Create default mos style
      const styleContent = this.createDefaultMosStyle();
      writeFileSync(mosStyle, styleContent);
      console.log('📝 Created default mos output style');
    }
  }

  /**
   * Set default output style to mos-focused
   */
  async setDefaultOutputStyle() {
    try {
      // Use Claude Code CLI to set default style
      execSync('claude config set output-style mos-default', { 
        stdio: 'ignore',
        timeout: 5000 
      });
      console.log('🎨 Applied default mos output style');
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
      settings.defaultOutputStyle = 'mos-default';
      writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
      console.log('📝 Updated default output style in settings.json');
    } catch (error) {
      console.warn('Could not update settings.json:', error.message);
    }
  }

  /**
   * Initialize mos - prepare for activity monitoring via MCP tools
   */
  async initializeMCPObservability() {
    try {
      // Create mos log directory to avoid conflicts with other MCP servers
      const logsDir = path.join(this.claudeDir, 'logs');
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      
      const logPath = path.join(logsDir, 'mos.log');
      if (!existsSync(logPath)) {
        writeFileSync(logPath, '');
        console.log('📝 Created MCP mos log file');
      }
      
      // The MCP server will handle activity monitoring via its tools
      // No direct hooks needed - Claude Code will call MCP tools for logging
      console.log('🔗 mos initialized - monitoring via MCP protocol');
    } catch (error) {
      console.warn('Could not initialize mos:', error.message);
    }
  }

  /**
   * Create default mos style content
   */
  createDefaultMosStyle() {
    return `---
name: "Observability Default"
description: "Auto-applied mos style when MCP server is active"
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

- **Natural Integration**: Don't over-emphasize mos unless relevant
- **Performance Awareness**: Note when operations seem slower than expected  
- **Context Sensitivity**: Reference activity data when it adds value
- **Actionable Insights**: Provide performance tips when appropriate

This style provides subtle mos awareness without changing your core helpfulness.`;
  }

  /**
   * mos relies on the MCP server's tools, not direct hooks
   * This method is kept for reference but no longer used for auto-configuration
   */
  createMCPObservabilityReference() {
    return {
      note: "Observability is handled by MCP server tools, not direct Claude Code hooks",
      approach: "Claude Code calls MCP server tools like log_event, stream_activity, get_health_status",
      benefits: [
        "Centralized mos logic in MCP server",
        "No direct settings.json manipulation needed", 
        "Proper MCP protocol usage",
        "Server-managed activity monitoring"
      ]
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