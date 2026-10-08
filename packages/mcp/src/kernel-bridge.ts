import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface CommandResult {
  success: boolean;
  created_ids: string[];
  error?: string;
  measurement?: number;
  warnings?: string[];
}

export interface KernelBridge {
  executeCommand(cmd: object): CommandResult;
  getEntitiesJson(): string;
  getLayersJson(): string;
  getTextStylesJson(): string;
  entityCount(): number;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
}

export async function createKernel(): Promise<KernelBridge> {
  const kernelPkgPath = dirname(fileURLToPath(import.meta.resolve('@nexus/kernel')));
  const wasmPath = join(kernelPkgPath, 'nexus_kernel_bg.wasm');
  const wasmBytes = readFileSync(wasmPath);

  const mod = await import('@nexus/kernel');

  if (mod.initSync) {
    mod.initSync({ module: new WebAssembly.Module(wasmBytes) });
  } else if (mod.default) {
    await mod.default(wasmBytes);
  }

  const kernel = new mod.Kernel();

  return {
    executeCommand(cmd: object): CommandResult {
      const json = kernel.execute_command(JSON.stringify(cmd));
      return JSON.parse(json);
    },
    getEntitiesJson(): string {
      return kernel.get_entities_json();
    },
    getLayersJson(): string {
      return kernel.get_layers_json();
    },
    getTextStylesJson(): string {
      return kernel.get_text_styles_json?.() ?? '[]';
    },
    entityCount(): number {
      return kernel.entity_count();
    },
    canUndo(): boolean {
      return kernel.can_undo();
    },
    canRedo(): boolean {
      return kernel.can_redo();
    },
    undo(): void {
      kernel.undo();
    },
    redo(): void {
      kernel.redo();
    },
  };
}
