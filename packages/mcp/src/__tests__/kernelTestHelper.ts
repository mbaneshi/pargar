import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TestKernel {
  kernel: any;
  exec: (cmd: object) => any;
  entityCount: () => number;
  getEntities: () => any[];
  getEntity: (id: string) => any;
}

export async function createTestKernel(): Promise<TestKernel> {
  const wasmPath = join(__dirname, '..', '..', '..', 'kernel', 'pkg', 'nexus_kernel_bg.wasm');
  const wasmBytes = readFileSync(wasmPath);
  const mod = await import('@nexus/kernel');
  if (mod.initSync) {
    mod.initSync({ module: new WebAssembly.Module(wasmBytes) });
  }
  const kernel = new mod.Kernel();
  const exec = (cmd: object) => JSON.parse(kernel.execute_command(JSON.stringify(cmd)));
  const entityCount = () => kernel.entity_count();
  const getEntities = () => JSON.parse(kernel.get_entities_json());
  const getEntity = (id: string) => JSON.parse(kernel.get_entity_json(id));
  return { kernel, exec, entityCount, getEntities, getEntity };
}
