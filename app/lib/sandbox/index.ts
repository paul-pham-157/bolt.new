/**
 * Hybrid Sandbox System
 * Supports both WebContainers (browser-based) and E2B (cloud-based) sandboxes
 *
 * Usage:
 * ```ts
 * import { createSandbox, SandboxFactory } from '~/lib/sandbox';
 *
 * // Auto-detect based on requirements
 * const requirements = SandboxFactory.analyzeProjectRequirements({
 *   userMessage: 'Build a Next.js app with PostgreSQL',
 * });
 * const recommendation = SandboxFactory.getRecommendation(requirements);
 *
 * // Create sandbox
 * const sandbox = createSandbox({
 *   type: recommendation.sandboxType,
 *   e2b: {
 *     apiKey: process.env.E2B_API_KEY,
 *   },
 * });
 *
 * await sandbox.boot();
 * await sandbox.fs.writeFile('test.js', 'console.log("Hello")');
 * await sandbox.process.exec('node test.js');
 * ```
 */

export type {
  ISandboxProvider,
  SandboxType,
  SandboxCapabilities,
  SandboxConfig,
  SandboxFileSystem,
  SandboxProcess,
  SandboxProcessManager,
  ProjectRequirements,
  SandboxCostEstimate,
  SpawnOptions,
} from './types';

export { WebContainerAdapter } from './webcontainer-adapter';
export { E2BAdapter } from './e2b-adapter';
export { SandboxFactory } from './sandbox-factory';

import type { ISandboxProvider, SandboxConfig } from './types';
import { SandboxFactory } from './sandbox-factory';

/**
 * Convenience function to create a sandbox
 */
export function createSandbox(config: SandboxConfig): ISandboxProvider {
  return SandboxFactory.create(config);
}

/**
 * Get default sandbox configuration from environment
 */
export function getDefaultSandboxConfig(): SandboxConfig {
  const sandboxType = (process.env.SANDBOX_TYPE || 'webcontainer') as SandboxConfig['type'];

  const config: SandboxConfig = {
    type: sandboxType,
  };

  if (sandboxType === 'e2b') {
    config.e2b = {
      apiKey: process.env.E2B_API_KEY || '',
      template: process.env.E2B_TEMPLATE,
      timeoutMs: process.env.E2B_TIMEOUT_MS ? parseInt(process.env.E2B_TIMEOUT_MS) : undefined,
    };
  } else {
    config.webcontainer = {
      workdirName: process.env.WORK_DIR_NAME || 'bolt-project',
    };
  }

  return config;
}
