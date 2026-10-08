import type { EventBus } from '../protocol/EventBus';
import type { Entity, GeometryType, EntityStyle, NexusKernel } from '../types/kernel';
import type { CadRenderer } from '@nexus/renderer';

export interface SelectionGate {
  canSelect(entityId: string): boolean;
  reason: string;
}

export interface SelectedEntity {
  id: string;
  geometry: GeometryType;
  layer_id: string;
  style?: EntityStyle;
}

export class SelectionSet {
  private _selectedIds = $state<Set<string>>(new Set());
  private _preselectedId = $state<string | null>(null);
  private _gate: SelectionGate | null = null;

  selectedEntity = $state<SelectedEntity | null>(null);

  private renderer: CadRenderer | null = null;
  private kernel: NexusKernel | null = null;
  private bus: EventBus | null = null;

  constructor(deps?: { renderer?: CadRenderer; kernel?: NexusKernel }) {
    this.renderer = deps?.renderer ?? null;
    this.kernel = deps?.kernel ?? null;
  }

  updateDeps(deps: { renderer?: CadRenderer; kernel?: NexusKernel }): void {
    if (deps.renderer !== undefined) this.renderer = deps.renderer;
    if (deps.kernel !== undefined) this.kernel = deps.kernel;
  }

  setBus(bus: EventBus): void {
    this.bus = bus;
  }

  get selectedIds(): ReadonlySet<string> {
    return this._selectedIds;
  }

  get preselectedId(): string | null {
    return this._preselectedId;
  }

  get count(): number {
    return this._selectedIds.size;
  }

  select(id: string): void {
    const prev = Array.from(this._selectedIds);
    if (this._gate && !this._gate.canSelect(id)) return;
    this._selectedIds = new Set([id]);
    this.fetchSelectedEntity(id);
    this.syncToRenderer();
    this.emitChanged(prev);
  }

  deselect(id: string): void {
    const prev = Array.from(this._selectedIds);
    const next = new Set(this._selectedIds);
    next.delete(id);
    this._selectedIds = next;
    this.updateSelectedEntity();
    this.syncToRenderer();
    this.emitChanged(prev);
  }

  toggle(id: string): void {
    const prev = Array.from(this._selectedIds);
    if (this._gate && !this._gate.canSelect(id)) return;
    const next = new Set(this._selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._selectedIds = next;
    this.updateSelectedEntity();
    this.syncToRenderer();
    this.emitChanged(prev);
  }

  selectMultiple(ids: string[]): void {
    const prev = Array.from(this._selectedIds);
    const filtered = this._gate ? ids.filter((id) => this._gate!.canSelect(id)) : ids;
    const next = new Set(this._selectedIds);
    for (const id of filtered) next.add(id);
    this._selectedIds = next;
    this.updateSelectedEntity();
    this.syncToRenderer();
    this.emitChanged(prev);
  }

  replaceWith(ids: string[]): void {
    const prev = Array.from(this._selectedIds);
    const filtered = this._gate ? ids.filter((id) => this._gate!.canSelect(id)) : ids;
    this._selectedIds = new Set(filtered);
    this.updateSelectedEntity();
    this.syncToRenderer();
    this.emitChanged(prev);
  }

  clear(): void {
    const prev = Array.from(this._selectedIds);
    this._selectedIds = new Set();
    this.selectedEntity = null;
    this.syncToRenderer();
    this.emitChanged(prev);
  }

  setPreselect(id: string | null): void {
    this._preselectedId = id;
  }

  installGate(gate: SelectionGate): void {
    this._gate = gate;
  }

  removeGate(): void {
    this._gate = null;
  }

  has(id: string): boolean {
    return this._selectedIds.has(id);
  }

  getIds(): string[] {
    return Array.from(this._selectedIds);
  }

  isEmpty(): boolean {
    return this._selectedIds.size === 0;
  }

  selectAll(): void {
    if (!this.kernel) return;
    const prev = Array.from(this._selectedIds);
    try {
      const entities: Entity[] = JSON.parse(this.kernel.get_entities_json());
      const ids = entities.map((e) => e.id);
      this._selectedIds = new Set(ids);
      this.updateSelectedEntity();
      this.syncToRenderer();
      this.emitChanged(prev);
    } catch {
      // kernel not ready
    }
  }

  selectByRect(x1: number, y1: number, x2: number, y2: number, mode: 'window' | 'crossing'): void {
    if (!this.renderer) return;
    const ids: string[] = this.renderer.selectByRect(x1, y1, x2, y2, mode);
    this.replaceWith(ids);
  }

  getSelectedIds(): string[] {
    return Array.from(this._selectedIds);
  }

  refreshEntity(id: string): void {
    this.fetchSelectedEntity(id);
  }

  private fetchSelectedEntity(id: string): void {
    if (!this.kernel) {
      this.selectedEntity = null;
      return;
    }
    try {
      const json = this.kernel.get_entity_json(id);
      this.selectedEntity = json ? JSON.parse(json) : null;
    } catch {
      this.selectedEntity = null;
    }
  }

  private updateSelectedEntity(): void {
    if (this._selectedIds.size === 1) {
      const [id] = this._selectedIds;
      this.fetchSelectedEntity(id);
    } else {
      this.selectedEntity = null;
    }
  }

  private emitChanged(previousIds: string[]): void {
    if (!this.bus) return;
    const ids = Array.from(this._selectedIds);
    if (
      ids.length === previousIds.length &&
      ids.every((id) => previousIds.includes(id)) &&
      previousIds.every((id) => ids.includes(id))
    )
      return;
    this.bus.emit('selection.changed', { ids, previousIds });
  }

  private syncToRenderer(): void {
    if (!this.renderer?.selectionManager) return;
    this.renderer.selectionManager.clear();
    for (const id of this._selectedIds) {
      this.renderer.selectionManager.select(id);
    }
    this.renderer.updateSelection();
    this.renderer.markDirty();
  }
}
