/**
 * Sandbox abstraction types for hybrid WebContainer/E2B support
 */

export type SandboxType = 'webcontainer' | 'e2b';

export interface SandboxCapabilities {
  supportsDatabase: boolean;
  supportsNativeBinaries: boolean;
  supportsPython: boolean;
  supportsFullNetwork: boolean;
  supportsGPU: boolean;
  maxMemoryMB: number;
  maxCPUs: number;
}

export interface SandboxProcess {
  pid?: number;
  exitCode?: number;
  output: ReadableStream<string>;
  kill: () => Promise<void>;
}

export interface SandboxFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  rm(path: string, options?: { recursive: boolean }): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface SandboxProcessManager {
  spawn(command: string, args?: string[], options?: SpawnOptions): Promise<SandboxProcess>;
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
}

export interface ISandboxProvider {
  readonly type: SandboxType;
  readonly capabilities: SandboxCapabilities;

  // Lifecycle
  boot(): Promise<void>;
  isReady(): boolean;
  dispose(): Promise<void>;

  // File system
  get fs(): SandboxFileSystem;

  // Process management
  get process(): SandboxProcessManager;

  // Port management (for web servers)
  getPort(port: number): Promise<string | null>;
  onPortOpen(callback: (port: number, url: string) => void): void;
}

export interface ProjectRequirements {
  needsDatabase?: boolean;
  needsNativeBinaries?: boolean;
  needsPython?: boolean;
  needsFullNetwork?: boolean;
  estimatedMemoryMB?: number;
}

export interface SandboxConfig {
  type: SandboxType;
  e2b?: {
    apiKey: string;
    template?: string;
    timeoutMs?: number;
  };
  webcontainer?: {
    workdirName?: string;
  };
}

export interface SandboxCostEstimate {
  sandboxType: SandboxType;
  estimatedCostPerHour: number;
  estimatedCostPerSession: number;
  currency: string;
  message: string;
}
