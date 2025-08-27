#!/usr/bin/env node
/**
 * Claude Code Statusline Script for MCP Observability
 * 
 * This script integrates with Claude Code's statusline system to display
 * real-time observability information in the status bar.
 * 
 * Installation:
 * 1. Make this file executable: chmod +x statusline-observability.js
 * 2. Configure in Claude Code: /statusline path/to/this/script
 * 3. Or add to settings.json:
 *    "statusline": {
 *      "script": "path/to/statusline-observability.js"
 *    }
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Parse Claude Code session input (JSON format as described in docs)
 */
function parseSessionInput() {
  try {
    // Claude Code passes session info via stdin
    let input = '';
    if (process.stdin.isTTY === false) {
      input = readFileSync(0, 'utf8');
    }
    
    if (input.trim()) {
      return JSON.parse(input);
    }
    
    // Fallback to environment variables or defaults
    return {
      sessionId: process.env.CLAUDE_SESSION_ID || 'unknown',
      workingDirectory: process.cwd(),
      model: process.env.CLAUDE_MODEL || 'claude-3-sonnet',
      cost: { total: 0 },
      version: '1.0.0'
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get observability data from MCP server
 */
async function getObservabilityData() {
  try {
    // Try to get health status from our MCP server
    const response = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'get_health_status',
        params: { detailed: false }
      }),
      timeout: 1000 // Quick timeout for statusline
    });
    
    const data = await response.json();
    const health = JSON.parse(data.result.content[0].text);
    
    return {
      available: true,
      health,
      memory: health.memory.current_mb,
      sessions: health.sessions.active,
      errorRate: Math.round(health.requests.error_rate * 100),
      status: health.status
    };
  } catch (error) {
    return {
      available: false,
      status: 'unavailable'
    };
  }
}

/**
 * Format statusline output
 */
function formatStatusline(sessionInfo, observabilityData) {
  const parts = [];
  
  // Model and basic info (following Claude Code patterns)
  const model = sessionInfo?.model || 'claude';
  parts.push(model);
  
  // Current directory (git-aware like the example)
  try {
    const gitBranch = execSync('git branch --show-current 2>/dev/null', { 
      encoding: 'utf8',
      cwd: sessionInfo?.workingDirectory || process.cwd()
    }).trim();
    
    const dir = sessionInfo?.workingDirectory?.split('/').pop() || 'unknown';
    parts.push(gitBranch ? `${dir}:${gitBranch}` : dir);
  } catch {
    const dir = sessionInfo?.workingDirectory?.split('/').pop() || 'unknown';
    parts.push(dir);
  }
  
  // Observability status
  if (observabilityData.available) {
    const statusIcon = observabilityData.status === 'healthy' ? '🟢' : 
                      observabilityData.status === 'warning' ? '🟡' : '🔴';
    
    parts.push(`${statusIcon}obs`);
    
    // Memory usage
    if (observabilityData.memory) {
      parts.push(`${observabilityData.memory}MB`);
    }
    
    // Active sessions
    if (observabilityData.sessions > 0) {
      parts.push(`${observabilityData.sessions}s`);
    }
    
    // Error rate (only show if > 0)
    if (observabilityData.errorRate > 0) {
      parts.push(`${observabilityData.errorRate}%err`);
    }
  } else {
    // Observability server not available
    parts.push('🔴obs');
  }
  
  // Session cost (if available)
  if (sessionInfo?.cost?.total) {
    parts.push(`$${sessionInfo.cost.total.toFixed(3)}`);
  }
  
  return parts.join(' | ');
}

/**
 * Main execution
 */
async function main() {
  try {
    const sessionInfo = parseSessionInput();
    const observabilityData = await getObservabilityData();
    const statusline = formatStatusline(sessionInfo, observabilityData);
    
    // Output to stdout (Claude Code reads first line as status)
    console.log(statusline);
    
    // Optional: Log detailed info to stderr for debugging
    if (process.env.DEBUG) {
      console.error('Session Info:', JSON.stringify(sessionInfo, null, 2));
      console.error('Observability Data:', JSON.stringify(observabilityData, null, 2));
    }
    
  } catch (error) {
    // Fallback statusline on error
    console.log('claude | obs:error');
    if (process.env.DEBUG) {
      console.error('Statusline error:', error);
    }
  }
}

// Handle both direct execution and module import
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { formatStatusline, getObservabilityData, parseSessionInput };