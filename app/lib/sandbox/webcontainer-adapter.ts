import { WebContainer } from '@webcontainer/api';
import type {
  ISandboxProvider,
  SandboxCapabilities,
  SandboxFileSystem,
  SandboxProcess,
  SandboxProcessManager,
  SpawnOptions,
} from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('WebContainerAdapter');

export class WebContainerAdapter implements ISandboxProvider {
  readonly type = 'webcontainer' as const;
  readonly capabilities: SandboxCapabilities = {
    supportsDatabase: false, // No native sockets
    supportsNativeBinaries: false, // WASM only
    supportsPython: false, // Limited WASI support
    supportsFullNetwork: false, // Service Workers only
    supportsGPU: false,
    maxMemoryMB: 2048, // Browser memory limit
    maxCPUs: 4, // Browser limit
  };

  private container: WebContainer | null = null;
  private portCallbacks: Array<(port: number, url: string) => void> = [];
  private workdirName: string;

  constructor(workdirName: string = 'bolt-project') {
    this.workdirName = workdirName;
  }

  async boot(): Promise<void> {
    if (this.container) {
      logger.debug('WebContainer already booted');
      return;
    }

    logger.info('Booting WebContainer...');

    try {
      this.container = await WebContainer.boot({
        workdirName: this.workdirName,
      });

      logger.info('WebContainer booted successfully');

      // Setup port listener
      this.container.on('server-ready', (port, url) => {
        logger.info(`Server ready on port ${port}: ${url}`);
        this.portCallbacks.forEach((callback) => callback(port, url));
      });
    } catch (error) {
      logger.error('Failed to boot WebContainer:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.container !== null;
  }

  async dispose(): Promise<void> {
    // WebContainer doesn't have explicit cleanup
    // It will be garbage collected when tab closes
    this.container = null;
    this.portCallbacks = [];
    logger.info('WebContainer disposed');
  }

  get fs(): SandboxFileSystem {
    return {
      readFile: async (path: string) => {
        this.ensureReady();
        const buffer = await this.container!.fs.readFile(path);
        return new TextDecoder().decode(buffer);
      },

      writeFile: async (path: string, content: string) => {
        this.ensureReady();
        await this.container!.fs.writeFile(path, content);
      },

      readdir: async (path: string) => {
        this.ensureReady();
        return await this.container!.fs.readdir(path);
      },

      mkdir: async (path: string, options?: { recursive: boolean }) => {
        this.ensureReady();
        await this.container!.fs.mkdir(path, options);
      },

      rm: async (path: string, options?: { recursive: boolean }) => {
        this.ensureReady();
        await this.container!.fs.rm(path, options);
      },

      exists: async (path: string) => {
        try {
          this.ensureReady();
          await this.container!.fs.readFile(path);
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

        const webcontainerProcess = await this.container!.spawn('jsh', ['-c', fullCommand], {
          env: options?.env,
        });

        // Convert WebContainer process to our interface
        const outputStream = new ReadableStream<string>({
          async start(controller) {
            const reader = webcontainerProcess.output.getReader();

            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return {
          output: outputStream,
          kill: async () => {
            webcontainerProcess.kill();
          },
          exitCode: undefined,
        };
      },

      exec: async (command: string) => {
        this.ensureReady();

        const process = await this.container!.spawn('jsh', ['-c', command]);

        let stdout = '';
        let stderr = '';

        const reader = process.output.getReader();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            stdout += value;
          }
        } catch (error) {
          stderr = String(error);
        }

        const exitCode = await process.exit;

        return { stdout, stderr, exitCode };
      },
    };
  }

  async getPort(port: number): Promise<string | null> {
    this.ensureReady();
    // WebContainer handles port mapping automatically
    // Return the expected URL format
    return `http://localhost:${port}`;
  }

  onPortOpen(callback: (port: number, url: string) => void): void {
    this.portCallbacks.push(callback);
  }

  private ensureReady(): void {
    if (!this.container) {
      throw new Error('WebContainer not ready. Call boot() first.');
    }
  }
}
