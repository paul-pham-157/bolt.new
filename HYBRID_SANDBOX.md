# Hybrid Sandbox System

Bolt.new now supports **hybrid sandbox execution** - choose between browser-based WebContainers or cloud-based E2B sandboxes based on your project needs.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Default: WebContainers                  │
│  ✅ Free, instant, offline                               │
│  ✅ Perfect for 90% of projects                          │
│  ❌ No databases, limited Python                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               Advanced: E2B Cloud Sandbox                │
│  ✅ Full Linux with databases, Python, native binaries   │
│  ✅ Perfect for complex projects                         │
│  ⚠️  Costs ~$0.03/hour, requires API key                 │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Default Mode (WebContainer)

Works out of the box - no configuration needed!

```bash
# Just start the app
npm run dev
```

### 2. Enable E2B Mode

**Step 1: Install E2B SDK**
```bash
npm install @e2b/code-interpreter
```

**Step 2: Get API Key**
- Sign up at [e2b.dev](https://e2b.dev)
- Go to [Dashboard](https://e2b.dev/dashboard)
- Copy your API key

**Step 3: Configure Environment**
```bash
# Copy example env file
cp .env.example .env

# Edit .env
SANDBOX_TYPE=e2b
E2B_API_KEY=your-api-key-here
```

**Step 4: Restart**
```bash
npm run dev
```

---

## When to Use Each Sandbox

### Use WebContainer (Default) when:

✅ Building standard web apps (React, Vue, Angular, etc.)
✅ Frontend-only projects
✅ Node.js APIs without databases
✅ You want zero cost
✅ You want instant startup
✅ You need offline support

### Use E2B Cloud when:

✅ Need **databases** (PostgreSQL, MongoDB, Redis, MySQL)
✅ Need **Python** with data science libraries (Pandas, NumPy, etc.)
✅ Need **native binaries** (FFmpeg, ImageMagick, Puppeteer)
✅ Need **full network access** (WebSockets, webhooks)
✅ Building **machine learning** applications
✅ Need **more than 2GB RAM**

---

## Architecture

```typescript
// High-level architecture
┌─────────────────────────────────────────────────────┐
│              Bolt.new Application                    │
├─────────────────────────────────────────────────────┤
│          ISandboxProvider Interface                  │
├─────────────────┬───────────────────────────────────┤
│  WebContainer   │         E2B Adapter               │
│   Adapter       │                                   │
│                 │                                   │
│  [Browser]      │      [Cloud microVM]              │
│  - WASM-based   │      - Firecracker                │
│  - 0ms latency  │      - 50-200ms latency           │
│  - $0 cost      │      - ~$0.03/hour                │
└─────────────────┴───────────────────────────────────┘
```

---

## Configuration Options

### Environment Variables

```bash
# Sandbox Type
SANDBOX_TYPE=webcontainer  # or 'e2b'

# WebContainer Settings (SANDBOX_TYPE=webcontainer)
WORK_DIR_NAME=bolt-project

# E2B Settings (SANDBOX_TYPE=e2b)
E2B_API_KEY=your-api-key
E2B_TEMPLATE=base  # Optional: custom template
E2B_TIMEOUT_MS=300000  # Optional: 5 minutes default
```

### Programmatic Configuration

```typescript
import { createSandbox, SandboxFactory } from '~/lib/sandbox';

// Create WebContainer sandbox
const webcontainer = createSandbox({
  type: 'webcontainer',
  webcontainer: {
    workdirName: 'my-project',
  },
});

// Create E2B sandbox
const e2b = createSandbox({
  type: 'e2b',
  e2b: {
    apiKey: process.env.E2B_API_KEY!,
    template: 'base',
    timeoutMs: 300000,
  },
});

// Boot and use
await webcontainer.boot();
await webcontainer.fs.writeFile('index.js', 'console.log("Hello")');
await webcontainer.process.exec('node index.js');
```

---

## Smart Detection

The system can **automatically detect** which sandbox to use based on project requirements:

```typescript
import { SandboxFactory } from '~/lib/sandbox';

// Analyze project
const requirements = SandboxFactory.analyzeProjectRequirements({
  dependencies: {
    'pg': '^8.11.0',  // PostgreSQL client
    'express': '^4.18.0',
  },
  userMessage: 'Build a Next.js app with PostgreSQL database',
});

// Get recommendation
const recommendation = SandboxFactory.getRecommendation(requirements);

console.log(recommendation);
// {
//   sandboxType: 'e2b',
//   reasons: [
//     'Project requires database support (PostgreSQL)',
//   ],
//   costEstimate: {
//     estimatedCostPerHour: 0.03,
//     estimatedCostPerSession: 0.05,
//     message: 'E2B cloud sandbox: ~$0.05 for 60 minutes',
//   },
//   canFallback: true,
// }
```

---

## API Reference

### ISandboxProvider Interface

All sandboxes implement this common interface:

```typescript
interface ISandboxProvider {
  // Lifecycle
  boot(): Promise<void>;
  isReady(): boolean;
  dispose(): Promise<void>;

  // File System
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
    rm(path: string, options?: { recursive: boolean }): Promise<void>;
    exists(path: string): Promise<boolean>;
  };

  // Process Management
  process: {
    spawn(cmd: string, args?: string[], opts?: SpawnOptions): Promise<SandboxProcess>;
    exec(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };

  // Port Management
  getPort(port: number): Promise<string | null>;
  onPortOpen(callback: (port: number, url: string) => void): void;

  // Metadata
  type: 'webcontainer' | 'e2b';
  capabilities: SandboxCapabilities;
}
```

### SandboxFactory Methods

```typescript
// Create sandbox from config
SandboxFactory.create(config: SandboxConfig): ISandboxProvider

// Detect required sandbox type
SandboxFactory.detectSandboxType(requirements: ProjectRequirements): SandboxType

// Analyze project to determine requirements
SandboxFactory.analyzeProjectRequirements(context): ProjectRequirements

// Get cost estimate
SandboxFactory.getCostEstimate(type: SandboxType, minutes: number): SandboxCostEstimate

// Get recommendation with explanation
SandboxFactory.getRecommendation(requirements): Recommendation

// Check if E2B is available
SandboxFactory.isE2BAvailable(): boolean
```

---

## Migration from WebContainer-only

### Before (Direct WebContainer usage):

```typescript
import { WebContainer } from '@webcontainer/api';

const container = await WebContainer.boot();
await container.fs.writeFile('index.js', code);
const process = await container.spawn('node', ['index.js']);
```

### After (Hybrid with abstraction):

```typescript
import { createSandbox } from '~/lib/sandbox';

const sandbox = createSandbox({
  type: process.env.SANDBOX_TYPE || 'webcontainer',
  e2b: { apiKey: process.env.E2B_API_KEY },
});

await sandbox.boot();
await sandbox.fs.writeFile('index.js', code);
const process = await sandbox.process.spawn('node', ['index.js']);
```

**Benefits:**
- ✅ Same code works with both sandboxes
- ✅ Easy to switch between modes
- ✅ Runtime sandbox selection
- ✅ Gradual migration path

---

## Cost Comparison

### WebContainer (Default)

| Metric | Value |
|--------|-------|
| **Cost per hour** | $0.00 |
| **Cost per user** | $0.00 |
| **Cost for 10,000 users** | $0.00 |
| **Infrastructure** | None needed |
| **Scaling** | Unlimited (client-side) |

### E2B Cloud

| Metric | Value |
|--------|-------|
| **Free Tier** | 100 sandbox hours/month |
| **Pro Plan** | $30/month (1000 hours) |
| **Cost per hour** | ~$0.03 |
| **10 min session** | ~$0.005 |
| **60 min session** | ~$0.03 |
| **Cost for 10,000 users** | $300-3000/month (depends on usage) |

**Cost Optimization Tips:**
- Use WebContainer for simple projects
- Only suggest E2B when detecting databases/Python
- Implement session timeouts
- Use E2B free tier for development

---

## UI Integration

### Sandbox Mode Selector Component

```tsx
import { SandboxModeSelector } from '~/components/settings/SandboxModeSelector';

function SettingsPanel() {
  const [sandboxMode, setSandboxMode] = useState<SandboxType>('webcontainer');

  return (
    <SandboxModeSelector
      currentMode={sandboxMode}
      onModeChange={setSandboxMode}
    />
  );
}
```

The component provides:
- ✅ Visual comparison of both modes
- ✅ Feature lists and limitations
- ✅ Cost information
- ✅ Confirmation dialog for E2B
- ✅ Availability checks

---

## Troubleshooting

### E2B SDK not found

```
Error: E2B SDK not available
```

**Solution:**
```bash
npm install @e2b/code-interpreter
```

### E2B API Key missing

```
Error: E2B API key is required
```

**Solution:**
```bash
# Add to .env
E2B_API_KEY=your-api-key-here
```

### E2B timeout

```
Error: Sandbox creation timeout
```

**Solution:**
```bash
# Increase timeout in .env
E2B_TIMEOUT_MS=600000  # 10 minutes
```

### Port not detected

E2B doesn't auto-detect ports like WebContainer. Ensure your server logs the port:

```javascript
// Good
const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

---

## Examples

### Example 1: Simple Web App (Use WebContainer)

```typescript
const sandbox = createSandbox({ type: 'webcontainer' });
await sandbox.boot();

await sandbox.fs.writeFile('package.json', JSON.stringify({
  dependencies: { express: '^4.18.0' }
}));

await sandbox.process.exec('npm install');
await sandbox.fs.writeFile('server.js', `
  const express = require('express');
  const app = express();
  app.get('/', (req, res) => res.send('Hello!'));
  app.listen(3000);
`);

await sandbox.process.spawn('node', ['server.js']);
```

### Example 2: App with Database (Use E2B)

```typescript
const sandbox = createSandbox({
  type: 'e2b',
  e2b: { apiKey: process.env.E2B_API_KEY! }
});
await sandbox.boot();

// Install PostgreSQL client
await sandbox.process.exec('npm install pg');

// Start PostgreSQL (available in E2B, not in WebContainer)
await sandbox.process.spawn('postgres', ['-D', '/var/lib/postgresql/data']);

// Write app code
await sandbox.fs.writeFile('app.js', `
  const { Client } = require('pg');
  const client = new Client();
  await client.connect();
  // ... database operations
`);

await sandbox.process.spawn('node', ['app.js']);
```

### Example 3: Python Data Science (Use E2B)

```typescript
const sandbox = createSandbox({
  type: 'e2b',
  e2b: { apiKey: process.env.E2B_API_KEY! }
});
await sandbox.boot();

// Install Python packages
if (sandbox.type === 'e2b') {
  await (sandbox as E2BAdapter).installPythonPackages([
    'pandas',
    'numpy',
    'matplotlib'
  ]);

  // Execute Python code
  const result = await (sandbox as E2BAdapter).executePython(`
    import pandas as pd
    df = pd.DataFrame({'A': [1, 2, 3]})
    print(df)
  `);

  console.log(result.stdout);
}
```

---

## Best Practices

### 1. Start with WebContainer

Default to WebContainer for all projects. Only use E2B when specific features are needed.

### 2. Smart Detection

Use `SandboxFactory.analyzeProjectRequirements()` to automatically detect needs:

```typescript
const requirements = SandboxFactory.analyzeProjectRequirements({
  dependencies: packageJson.dependencies,
  userMessage: chatMessage,
});

const sandboxType = SandboxFactory.detectSandboxType(requirements);
```

### 3. Cost Awareness

Always show cost estimates before switching to E2B:

```typescript
const cost = SandboxFactory.getCostEstimate('e2b', 60);
console.log(cost.message); // "E2B cloud sandbox: ~$0.03 for 60 minutes"
```

### 4. Graceful Fallback

If E2B fails, fallback to WebContainer when possible:

```typescript
try {
  const sandbox = createSandbox({ type: 'e2b', ... });
  await sandbox.boot();
} catch (error) {
  console.warn('E2B failed, falling back to WebContainer');
  const sandbox = createSandbox({ type: 'webcontainer' });
  await sandbox.boot();
}
```

### 5. Session Management

Implement proper cleanup to avoid unnecessary E2B costs:

```typescript
// Always cleanup when done
window.addEventListener('beforeunload', async () => {
  await sandbox.dispose();
});

// Implement timeout
setTimeout(async () => {
  if (idle) {
    await sandbox.dispose();
  }
}, 300000); // 5 minutes
```

---

## Contributing

Want to add support for more sandbox providers? Follow this pattern:

1. Implement `ISandboxProvider` interface
2. Add to `SandboxFactory.create()`
3. Update `SandboxType` union
4. Add detection logic
5. Update documentation

---

## License

MIT - Same as Bolt.new

---

## Support

- **Documentation**: [bolt.new/docs](https://bolt.new/docs)
- **E2B Docs**: [e2b.dev/docs](https://e2b.dev/docs)
- **Issues**: [github.com/stackblitz/bolt.new/issues](https://github.com/stackblitz/bolt.new/issues)
