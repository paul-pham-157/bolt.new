/**
 * Sandbox Factory - Creates appropriate sandbox based on requirements
 */

import type {
  ISandboxProvider,
  ProjectRequirements,
  SandboxConfig,
  SandboxType,
  SandboxCostEstimate,
} from './types';
import { WebContainerAdapter } from './webcontainer-adapter';
import { E2BAdapter } from './e2b-adapter';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SandboxFactory');

export class SandboxFactory {
  /**
   * Create sandbox based on configuration
   */
  static create(config: SandboxConfig): ISandboxProvider {
    logger.info('Creating sandbox', { type: config.type });

    switch (config.type) {
      case 'webcontainer':
        return new WebContainerAdapter(config.webcontainer?.workdirName);

      case 'e2b':
        if (!config.e2b?.apiKey) {
          throw new Error('E2B API key is required for E2B sandbox type');
        }
        return new E2BAdapter({
          apiKey: config.e2b.apiKey,
          template: config.e2b.template,
          timeoutMs: config.e2b.timeoutMs,
        });

      default:
        throw new Error(`Unknown sandbox type: ${config.type}`);
    }
  }

  /**
   * Detect required sandbox type based on project requirements
   */
  static detectSandboxType(requirements: ProjectRequirements): SandboxType {
    const {
      needsDatabase,
      needsNativeBinaries,
      needsPython,
      needsFullNetwork,
      estimatedMemoryMB,
    } = requirements;

    // If any advanced feature is needed, use E2B
    if (needsDatabase || needsNativeBinaries || needsPython || needsFullNetwork) {
      logger.info('Detected need for E2B sandbox', requirements);
      return 'e2b';
    }

    // If memory requirements are high, use E2B
    if (estimatedMemoryMB && estimatedMemoryMB > 2048) {
      logger.info('Detected high memory requirement, using E2B', { estimatedMemoryMB });
      return 'e2b';
    }

    // Default to WebContainer for standard web projects
    logger.info('Using WebContainer for standard web project');
    return 'webcontainer';
  }

  /**
   * Analyze code/project to determine requirements
   */
  static analyzeProjectRequirements(projectContext: {
    files?: Array<{ path: string; content?: string }>;
    dependencies?: Record<string, string>;
    userMessage?: string;
  }): ProjectRequirements {
    const requirements: ProjectRequirements = {
      needsDatabase: false,
      needsNativeBinaries: false,
      needsPython: false,
      needsFullNetwork: false,
      estimatedMemoryMB: 512,
    };

    // Analyze dependencies
    if (projectContext.dependencies) {
      const deps = Object.keys(projectContext.dependencies);

      // Database detection
      const databasePackages = ['pg', 'postgres', 'mysql', 'mysql2', 'mongodb', 'mongoose', 'redis', 'ioredis', 'sqlite3', 'better-sqlite3'];
      requirements.needsDatabase = deps.some((dep) =>
        databasePackages.some((dbPkg) => dep.includes(dbPkg))
      );

      // Native binary detection
      const nativeBinaryPackages = ['sharp', 'canvas', 'node-gyp', 'sqlite3', 'bcrypt', '@tensorflow'];
      requirements.needsNativeBinaries = deps.some((dep) =>
        nativeBinaryPackages.some((nativePkg) => dep.includes(nativePkg))
      );

      // Python detection
      requirements.needsPython = deps.some((dep) => dep.includes('python'));
    }

    // Analyze file extensions
    if (projectContext.files) {
      const hasPythonFiles = projectContext.files.some((f) => f.path.endsWith('.py'));
      if (hasPythonFiles) {
        requirements.needsPython = true;
      }

      // Check for Docker/docker-compose
      const hasDocker = projectContext.files.some(
        (f) => f.path.includes('Dockerfile') || f.path.includes('docker-compose')
      );
      if (hasDocker) {
        requirements.needsNativeBinaries = true;
      }
    }

    // Analyze user message for keywords
    if (projectContext.userMessage) {
      const message = projectContext.userMessage.toLowerCase();

      if (message.match(/\b(database|postgres|mysql|mongodb|redis)\b/)) {
        requirements.needsDatabase = true;
      }

      if (message.match(/\b(python|pip|jupyter|pandas|numpy|tensorflow)\b/)) {
        requirements.needsPython = true;
      }

      if (message.match(/\b(native|binary|c\+\+|rust|go)\b/)) {
        requirements.needsNativeBinaries = true;
      }

      if (message.match(/\b(websocket|real-time|webhook)\b/)) {
        requirements.needsFullNetwork = true;
      }
    }

    logger.debug('Analyzed project requirements', requirements);

    return requirements;
  }

  /**
   * Get cost estimate for sandbox type
   */
  static getCostEstimate(sandboxType: SandboxType, estimatedDurationMinutes: number = 60): SandboxCostEstimate {
    if (sandboxType === 'webcontainer') {
      return {
        sandboxType: 'webcontainer',
        estimatedCostPerHour: 0,
        estimatedCostPerSession: 0,
        currency: 'USD',
        message: 'WebContainer runs in the browser - completely free!',
      };
    }

    // E2B pricing (as of 2024)
    // Free tier: 100 hours/month
    // Pro: $30/month for 1000 hours (~$0.03/hour)
    const costPerHour = 0.03;
    const costPerSession = (costPerHour / 60) * estimatedDurationMinutes;

    return {
      sandboxType: 'e2b',
      estimatedCostPerHour: costPerHour,
      estimatedCostPerSession: Math.round(costPerSession * 100) / 100,
      currency: 'USD',
      message: `E2B cloud sandbox: ~$${costPerSession.toFixed(2)} for ${estimatedDurationMinutes} minutes`,
    };
  }

  /**
   * Check if E2B is available and configured
   */
  static isE2BAvailable(): boolean {
    try {
      require.resolve('@e2b/code-interpreter');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recommended sandbox with explanation
   */
  static getRecommendation(
    requirements: ProjectRequirements
  ): {
    sandboxType: SandboxType;
    reasons: string[];
    costEstimate: SandboxCostEstimate;
    canFallback: boolean;
  } {
    const sandboxType = this.detectSandboxType(requirements);
    const reasons: string[] = [];
    const costEstimate = this.getCostEstimate(sandboxType);

    if (sandboxType === 'e2b') {
      if (requirements.needsDatabase) {
        reasons.push('Project requires database support (PostgreSQL, MongoDB, Redis, etc.)');
      }
      if (requirements.needsNativeBinaries) {
        reasons.push('Project requires native binaries (FFmpeg, ImageMagick, etc.)');
      }
      if (requirements.needsPython) {
        reasons.push('Project requires full Python support with pip packages');
      }
      if (requirements.needsFullNetwork) {
        reasons.push('Project requires full network access (WebSockets, webhooks, etc.)');
      }
      if (requirements.estimatedMemoryMB && requirements.estimatedMemoryMB > 2048) {
        reasons.push(`Project requires ${requirements.estimatedMemoryMB}MB memory`);
      }
    } else {
      reasons.push('Standard web project - WebContainer is perfect for this!');
      reasons.push('Zero cost, instant startup, works offline');
    }

    return {
      sandboxType,
      reasons,
      costEstimate,
      canFallback: sandboxType === 'e2b', // Can fallback to WebContainer if E2B unavailable
    };
  }
}
