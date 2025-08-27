# MCP Observability Server - Production Deployment Guide

## 🚀 Production Deployment

This guide covers deploying the MCP Observability Server in production environments.

## 📋 Prerequisites

- **Node.js**: Version 18+ required
- **Memory**: Minimum 256MB RAM, recommended 512MB+
- **CPU**: 1 core minimum, 2+ cores for high-load environments
- **Storage**: Minimal disk usage (in-memory storage by default)
- **Network**: Access to Claude Code instances

## ⚙️ Production Configuration

### Environment Variables

```bash
# Production settings
export NODE_ENV=production
export MCP_LOG_LEVEL=warn
export MCP_MAX_MEMORY_MB=512
export MCP_SESSION_TIMEOUT_MS=86400000  # 24 hours
export MCP_MAX_EVENTS_PER_SESSION=1000
export MCP_HEALTH_CHECK_INTERVAL_MS=30000
```

### Configuration File

Create `config/production.json`:

```json
{
  "server": {
    "name": "mcp-observability-server",
    "version": "1.0.0"
  },
  "health": {
    "maxMemoryMB": 512,
    "maxResponseTimeMS": 1000,
    "maxErrorRate": 0.05,
    "healthCheckInterval": 30000
  },
  "session": {
    "maxEventsPerSession": 1000,
    "sessionTimeoutMs": 86400000
  },
  "streaming": {
    "slowThresholdMs": 500,
    "bufferSize": 100
  },
  "logging": {
    "level": "warn",
    "includeStack": false
  }
}
```

### Production Server Script

Create `src/production-server.js`:

```javascript
import { ObservabilityServer } from './server.js';
import fs from 'fs';
import path from 'path';

// Load production configuration
const configPath = process.env.MCP_CONFIG_PATH || 'config/production.json';
let config = {};

try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.error('Failed to load config:', error.message);
  process.exit(1);
}

// Apply environment variable overrides
if (process.env.MCP_MAX_MEMORY_MB) {
  config.health = config.health || {};
  config.health.maxMemoryMB = parseInt(process.env.MCP_MAX_MEMORY_MB);
}

if (process.env.MCP_SESSION_TIMEOUT_MS) {
  config.session = config.session || {};
  config.session.sessionTimeoutMs = parseInt(process.env.MCP_SESSION_TIMEOUT_MS);
}

// Start server with production configuration
const server = new ObservabilityServer(config);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

server.run().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
```

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcpserver -u 1001

# Set ownership
RUN chown -R mcpserver:nodejs /app
USER mcpserver

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "
    import('./src/server.js').then(({ ObservabilityServer }) => {
      const server = new ObservabilityServer();
      // Simple health check - if server can be created, it's healthy
      process.exit(0);
    }).catch(() => process.exit(1))
  "

# Expose default port (not used for MCP but useful for health checks)
EXPOSE 3000

# Start server
CMD ["node", "src/production-server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  mcp-observability:
    build: .
    container_name: mcp-observability-server
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MCP_MAX_MEMORY_MB=512
      - MCP_SESSION_TIMEOUT_MS=86400000
      - MCP_LOG_LEVEL=warn
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD-SHELL", "node -e 'process.exit(0)'"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  mcp-network:
    driver: bridge
```

## 🏗️ Kubernetes Deployment

### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-observability-server
  namespace: mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-observability-server
  template:
    metadata:
      labels:
        app: mcp-observability-server
    spec:
      containers:
      - name: mcp-observability
        image: mcp-observability-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MCP_MAX_MEMORY_MB
          value: "512"
        - name: MCP_SESSION_TIMEOUT_MS
          value: "86400000"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: mcp-observability-config
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-observability-service
  namespace: mcp
spec:
  selector:
    app: mcp-observability-server
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

## 📊 Monitoring & Observability

### Metrics Collection

The server provides built-in metrics through the `get_health_status` method:

```bash
# Health check endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "get_health_status",
    "params": { "detailed": true }
  }'
```

### Key Metrics to Monitor

1. **System Health**
   - Memory usage (should stay under configured limit)
   - Response time (avg should be <100ms)
   - Error rate (should be <5%)
   - Active sessions

2. **Performance Metrics**
   - Events processed per second
   - Session creation rate
   - Stream update latency
   - Activity tree build time

3. **Resource Usage**
   - Heap memory usage
   - CPU utilization
   - Network connections
   - File descriptors

### Alerts

Set up alerts for:
- Memory usage >80% of limit
- Error rate >5%
- Response time >1000ms
- Health status != "healthy"

## 🚨 Troubleshooting

### Common Issues

**High Memory Usage**
```bash
# Check current memory usage
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" \
  -d '{"method": "get_health_status", "params": {"detailed": true}}'

# Reduce session timeout or max events per session
export MCP_SESSION_TIMEOUT_MS=3600000  # 1 hour
export MCP_MAX_EVENTS_PER_SESSION=500
```

**Slow Response Times**
```bash
# Check detailed metrics
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" \
  -d '{"method": "get_health_status", "params": {"detailed": true}}'

# Look for slow methods in method_breakdown
```

**Circuit Breaker Tripped**
- Check error logs for underlying issues
- Verify Claude Code connection
- Restart server if needed

### Debugging

Enable debug logging:
```bash
export NODE_ENV=development
export DEBUG=mcp:*
```

Check health status:
```bash
# Basic health check
node -e "
import('./src/server.js').then(async ({ ObservabilityServer }) => {
  const server = new ObservabilityServer();
  // Add health check logic
});
"
```

## 🔧 Performance Tuning

### Memory Optimization

- Reduce `maxEventsPerSession` for memory-constrained environments
- Decrease `sessionTimeoutMs` for faster cleanup
- Enable garbage collection monitoring in production

### CPU Optimization

- Use multiple replicas/instances for high load
- Consider load balancing for multiple Claude Code instances
- Tune health check intervals

### Network Optimization

- Place server close to Claude Code instances
- Use connection pooling if applicable
- Monitor network latency

## 🔐 Security

### Access Control

- Run as non-root user in containers
- Use read-only filesystems where possible
- Limit resource usage with containers/k8s

### Data Privacy

- Event data is kept in memory by default (not persisted)
- Sessions expire automatically (24-hour default)
- No sensitive data is logged in production mode

### Network Security

- Use private networks for Claude Code communication
- Consider TLS for sensitive environments
- Implement network policies in Kubernetes

## 📈 Scaling

### Horizontal Scaling

- Deploy multiple instances behind a load balancer
- Use session affinity if needed
- Consider distributed session storage for large deployments

### Vertical Scaling

- Monitor memory and CPU usage
- Scale resources based on session count and event volume
- Consider SSD storage for better performance

### Auto-scaling

Configure Kubernetes HPA:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-observability-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-observability-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 🔄 Backup & Recovery

Since the server uses in-memory storage by default:
- No backup required for ephemeral data
- Session state is automatically recovered on restart
- Consider persistent storage for audit requirements

## 📋 Maintenance

### Regular Tasks

1. **Monitor resource usage** - Check memory and CPU trends
2. **Review error logs** - Look for patterns or issues
3. **Update dependencies** - Keep packages up to date
4. **Performance testing** - Validate performance under load

### Updates

1. Test new versions in staging environment
2. Use rolling deployments for zero-downtime updates
3. Have rollback plan ready
4. Monitor health after deployment

The MCP Observability Server is designed for high availability and production workloads while maintaining simplicity and performance.