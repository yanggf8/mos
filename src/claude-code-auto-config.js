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
    this.backupFile = path.join(this.claudeDir, '.mos-style-backup.json');
  }

  /**
   * Apply default observability configuration when server starts
   * MOS provides dynamic output behavior through MCP protocol responses
   */
  async applyDefaultConfiguration() {
    console.log('🔧 Initializing MOS observability integration...');

    try {
      // 1. Initialize mos logging and session tracking
      await this.initializeMCPObservability();
      
      // 2. MOS will inject monitoring behavior through MCP responses
      // No config file changes needed - all dynamic through SDK
      
      console.log('✅ MOS observability integration ready');
      console.log('📡 Dynamic output styling will activate when Claude uses MCP tools');
      return true;
    } catch (error) {
      console.warn('⚠️  Could not initialize MOS integration:', error.message);
      return false;
    }
  }

  /**
   * Ensure mos output styles are installed and copy monitoring companion style
   */
  async ensureOutputStyles() {
    const stylesDir = this.outputStylesDir;
    
    if (!existsSync(stylesDir)) {
      mkdirSync(stylesDir, { recursive: true });
      console.log('📁 Created output-styles directory');
    }

    // Copy monitoring companion style from examples
    const sourceStyle = path.join(process.cwd(), 'examples', 'output-styles', 'monitoring-companion.md');
    const targetStyle = path.join(stylesDir, 'mos-monitoring-companion.md');
    
    try {
      if (existsSync(sourceStyle)) {
        const styleContent = readFileSync(sourceStyle, 'utf8');
        writeFileSync(targetStyle, styleContent);
        console.log('📝 Applied mos-monitoring-companion output style');
      } else {
        // Fallback: create basic monitoring style
        const styleContent = this.createMonitoringCompanionStyle();
        writeFileSync(targetStyle, styleContent);
        console.log('📝 Created fallback mos-monitoring-companion output style');
      }
    } catch (error) {
      console.warn('Could not install output style:', error.message);
    }
  }

  /**
   * Store current output style and apply MOS monitoring companion style
   */
  async setDefaultOutputStyle() {
    // First, backup the current output style
    await this.backupCurrentOutputStyle();
    
    try {
      // Use Claude Code CLI to set monitoring companion style
      execSync('claude config set output-style mos-monitoring-companion', { 
        stdio: 'ignore',
        timeout: 5000 
      });
      console.log('🎨 Applied mos-monitoring-companion output style (original backed up)');
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
      settings.defaultOutputStyle = 'mos-monitoring-companion';
      writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
      console.log('📝 Updated output style to mos-monitoring-companion in settings.json (original backed up)');
    } catch (error) {
      console.warn('Could not update settings.json:', error.message);
    }
  }

  /**
   * Backup current output style before applying MOS style
   */
  async backupCurrentOutputStyle() {
    try {
      let currentStyle = null;
      
      // Try to get current style from CLI
      try {
        const result = execSync('claude config get output-style', { 
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 3000,
          encoding: 'utf8'
        });
        currentStyle = result.trim();
      } catch (error) {
        // Fallback: get from settings.json
        if (existsSync(this.settingsFile)) {
          const settings = JSON.parse(readFileSync(this.settingsFile, 'utf8'));
          currentStyle = settings.defaultOutputStyle || null;
        }
      }
      
      // Store backup info
      const backup = {
        timestamp: new Date().toISOString(),
        originalStyle: currentStyle,
        backupReason: 'MOS MCP server activation'
      };
      
      writeFileSync(this.backupFile, JSON.stringify(backup, null, 2));
      console.log(`💾 Backed up original output style: ${currentStyle || 'default'}`);
    } catch (error) {
      console.warn('Could not backup current output style:', error.message);
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
   * Create monitoring companion style content (fallback)
   */
  createMonitoringCompanionStyle() {
    return `---
name: "MOS Monitoring Companion"
description: "Real-time activity display for Claude Code with MOS integration"
version: "1.0.0"
---

# MOS Monitoring Companion

You are a development companion that provides real-time insights about system activity, performance, and observability with MOS integration.

## Response Behavior

### Live Activity Display
Show real-time activity for all operations:
- 🔧 TOOL operations with timing
- 🤖 AGENT/subagent activities  
- 📋 TASK progress indicators
- 📊 MCP server interactions

### Performance Indicators  
- ✅ Fast: <500ms
- 🟡 Moderate: 500ms-2s
- 🟠 Slow: 2s-5s
- 🔴 Very slow: >5s

### Session Metrics
Include periodic session status:
- 📈 Session: X operations, Y% success rate, avg Zms

## Example Format

\`\`\`
🎯 Implementing authentication system...

🔧 TOOL file_read - Reading auth.js (45ms) ✅
🤖 AGENT fullstack_engineer - Designing system (2.1s) 🟡
📋 TASK: Authentication implementation in progress

📈 Session: 3 operations completed, 100% success rate, avg 890ms
\`\`\`

Provide natural, helpful responses with integrated observability context.`;
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