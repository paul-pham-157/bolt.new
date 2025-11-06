/**
 * E2B Sandbox Adapter
 * Provides cloud-based sandboxing with full Linux capabilities
 *
 * To use E2B:
 * 1. Install: npm install @e2b/code-interpreter
 * 2. Set E2B_API_KEY environment variable
 * 3. Configure sandbox type to 'e2b'
 */

import type {
  ISandboxProvider,
  SandboxCapabilities,
  SandboxFileSystem,
  SandboxProcess,
  SandboxProcessManager,
  SpawnOptions,
} from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('E2BAdapter');

// Type definition for E2B SDK (optional dependency)
type E2BSandbox = any;

export interface E2BConfig {
  apiKey: string;
  template?: string;
  timeoutMs?: number;
  metadata?: Record<string, string>;
}

export class E2BAdapter implements ISandboxProvider {
  readonly type = 'e2b' as const;
  readonly capabilities: SandboxCapabilities = {
    supportsDatabase: true, // PostgreSQL, MongoDB, Redis, etc.
    supportsNativeBinaries: true, // Full Linux environment
    supportsPython: true, // Full Python with pip
    supportsFullNetwork: true, // Real TCP/UDP sockets
    supportsGPU: false, // Optional, requires special setup
    maxMemoryMB: 8192, // Configurable, up to 32GB on enterprise
    maxCPUs: 8, // Configurable
  };

  private sandbox: E2BSandbox | null = null;
  private config: E2BConfig;
  private portCallbacks: Array<(port: number, url: string) => void> = [];
  private isE2BAvailable: boolean = false;

  constructor(config: E2BConfig) {
    this.config = config;
    this.checkE2BAvailability();
  }

  private checkE2BAvailability() {
    try {
      // Try to require E2B SDK
      require.resolve('@e2b/code-interpreter');
      this.isE2BAvailable = true;
      logger.info('E2B SDK is available');
    } catch {
      this.isE2BAvailable = false;
      logger.warn('E2B SDK not installed. Run: npm install @e2b/code-interpreter');
    }
  }

  async boot(): Promise<void> {
    if (this.sandbox) {
      logger.debug('E2B Sandbox already booted');
      return;
    }

    if (!this.isE2BAvailable) {
      throw new Error(
        'E2B SDK not available. Install with: npm install @e2b/code-interpreter'
      );
    }

    if (!this.config.apiKey) {
      throw new Error('E2B API key is required. Set E2B_API_KEY environment variable.');
    }

    logger.info('Booting E2B Sandbox...');

    try {
      // Dynamically import E2B SDK
      const { Sandbox } = await import('@e2b/code-interpreter');

      this.sandbox = await Sandbox.create({
        apiKey: this.config.apiKey,
        template: this.config.template,
        timeoutMs: this.config.timeoutMs || 300000, // 5 minutes default
        metadata: this.config.metadata,
      });

      logger.info('E2B Sandbox booted successfully', {
        sandboxId: this.sandbox.sandboxId,
      });

      // Setup port scanning (E2B doesn't auto-detect like WebContainer)
      this.startPortScanning();
    } catch (error) {
      logger.error('Failed to boot E2B Sandbox:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.sandbox !== null;
  }

  async dispose(): Promise<void> {
    if (this.sandbox) {
      try {
        logger.info('Disposing E2B Sandbox...');
        await this.sandbox.kill();
        this.sandbox = null;
        logger.info('E2B Sandbox disposed');
      } catch (error) {
        logger.error('Error disposing E2B Sandbox:', error);
      }
    }
    this.portCallbacks = [];
  }

  get fs(): SandboxFileSystem {
    return {
      readFile: async (path: string) => {
        this.ensureReady();
        const content = await this.sandbox!.filesystem.read(path);
        return content;
      },

      writeFile: async (path: string, content: string) => {
        this.ensureReady();
        await this.sandbox!.filesystem.write(path, content);
      },

      readdir: async (path: string) => {
        this.ensureReady();
        const result = await this.sandbox!.filesystem.list(path);
        return result.map((item: any) => item.name);
      },

      mkdir: async (path: string, options?: { recursive: boolean }) => {
        this.ensureReady();
        const cmd = options?.recursive ? `mkdir -p "${path}"` : `mkdir "${path}"`;
        await this.sandbox!.process.start({ cmd });
      },

      rm: async (path: string, options?: { recursive: boolean }) => {
        this.ensureReady();
        const cmd = options?.recursive ? `rm -rf "${path}"` : `rm "${path}"`;
        await this.sandbox!.process.start({ cmd });
      },

      exists: async (path: string) => {
        try {
          this.ensureReady();
          await this.sandbox!.filesystem.read(path);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  get process(): SandboxProcessManager {
    return {
      spawn: async (command: string, args: string[] = [], options?: SpawnOptions) => {
        this.ensureReady();

        const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

        const e2bProcess = await this.sandbox!.process.start({
          cmd: fullCommand,
          envs: options?.env,
          cwd: options?.cwd,
        });

        // Convert E2B output to ReadableStream
        const outputStream = new ReadableStream<string>({
          start(controller) {
            // E2B provides onStdout and onStderr callbacks
            e2bProcess.stdout.on('data', (data: string) => {
              controller.enqueue(data);
            });

            e2bProcess.stderr.on('data', (data: string) => {
              controller.enqueue(data);
            });

            e2bProcess.on('exit', () => {
              controller.close();
            });
          },
        });

        return {
          pid: e2bProcess.pid,
          output: outputStream,
          kill: async () => {
            await e2bProcess.kill();
          },
          exitCode: undefined,
        };
      },

      exec: async (command: string) => {
        this.ensureReady();

        const result = await this.sandbox!.process.start({
          cmd: command,
        });

        // Wait for process to complete
        await result.wait();

        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode || 0,
        };
      },
    };
  }

  async getPort(port: number): Promise<string | null> {
    this.ensureReady();

    // E2B provides sandbox URL
    // Format: https://{sandboxId}-{port}.e2b.dev
    const sandboxId = this.sandbox!.sandboxId;
    return `https://${sandboxId}-${port}.e2b.dev`;
  }

  onPortOpen(callback: (port: number, url: string) => void): void {
    this.portCallbacks.push(callback);
  }

  private async startPortScanning() {
    // E2B doesn't auto-detect open ports like WebContainer
    // We need to periodically scan for common dev server ports
    const commonPorts = [3000, 3001, 4000, 5000, 5173, 8000, 8080, 8888];

    const scanInterval = setInterval(async () => {
      if (!this.sandbox) {
        clearInterval(scanInterval);
        return;
      }

      for (const port of commonPorts) {
        try {
          // Check if port is listening
          const result = await this.sandbox.process.start({
            cmd: `netstat -tuln | grep :${port}`,
          });

          await result.wait();

          if (result.exitCode === 0) {
            const url = await this.getPort(port);
            if (url) {
              logger.info(`Detected server on port ${port}: ${url}`);
              this.portCallbacks.forEach((callback) => callback(port, url));
            }
          }
        } catch {
          // Port not open, continue
        }
      }
    }, 2000); // Scan every 2 seconds
  }

  private ensureReady(): void {
    if (!this.sandbox) {
      throw new Error('E2B Sandbox not ready. Call boot() first.');
    }
  }

  // Additional E2B-specific methods

  /**
   * Install Python packages using pip
   */
  async installPythonPackages(packages: string[]): Promise<void> {
    this.ensureReady();
    const result = await this.sandbox!.process.start({
      cmd: `pip install ${packages.join(' ')}`,
    });
    await result.wait();

    if (result.exitCode !== 0) {
      throw new Error(`Failed to install Python packages: ${result.stderr}`);
    }
  }

  /**
   * Execute Python code in Jupyter notebook
   */
  async executePython(code: string): Promise<any> {
    this.ensureReady();
    return await this.sandbox!.runCode(code, { language: 'python' });
  }

  /**
   * Get sandbox metadata
   */
  getSandboxInfo() {
    if (!this.sandbox) return null;

    return {
      sandboxId: this.sandbox.sandboxId,
      template: this.config.template,
      status: 'running',
    };
  }
}
