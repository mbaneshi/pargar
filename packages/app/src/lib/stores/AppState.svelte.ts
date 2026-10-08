import type { CadRenderer } from '@nexus/renderer';
import type {
  NexusKernel,
  Layer,
  CommandResult,
  GeometryType,
  TextStyle,
  DrawingUnits,
} from '../types/kernel';
import type { SelectionSet } from '../shell/SelectionSet.svelte';
import { EventBus } from '../protocol/EventBus';
import type { EventSource } from '../protocol/EventTypes';
import { resolveChannels } from '../events/channelResolver';
import { AuthService } from '../cloud/auth.svelte';
import { CloudStorageService } from '../cloud/storage';
import type { DrawingTemplate } from '../templates/templates';
import { showToast } from './toastStore.svelte';
import { actionRecorder } from './actionRecorderStore.svelte';
import {
  readSysvarInt,
  writeSysvarInt,
  snapEnabledFromOsmode,
  setSnapEnabledOnOsmode,
  modeFlagFromInt,
  setModeFlagOnInt,
  bitFromInt,
  setBitOnInt,
  AUTOSNAP_POLAR_TRACK_BIT,
  AUTOSNAP_OTRACK_BIT,
} from './sysvar-bridge';

export interface DrawingDocument {
  id: string;
  name: string;
  serializedState?: string;
}

export class AppState {
  kernel: NexusKernel | null = $state(null);
  renderer: CadRenderer | null = $state(null);

  // Cloud
  authService: AuthService | null = $state(null);
  cloudStorage: CloudStorageService | null = $state(null);
  cloudProjectId = $state('');
  guestMode = $state(false);
  private cloudSaveTimer: ReturnType<typeof setInterval> | null = null;

  // Project
  projectName = $state('untitled');
  autoSaveStatus = $state('');

  // Multi-document
  documents = $state<DrawingDocument[]>([{ id: 'doc_1', name: 'untitled' }]);
  activeDocumentId = $state('doc_1');
  private nextDocNum = 2;

  // Viewport
  cursorX = $state(0);
  cursorY = $state(0);
  snapX = $state(0);
  snapY = $state(0);
  hasSnap = $state(false);
  snapType = $state('');

  // S4-A: status-bar toggles (snapEnabled / gridSnapEnabled / gridEnabled /
  // orthoMode / polarEnabled / otrackEnabled) are getter/setter pairs that
  // round-trip through the kernel sysvar registry. Pre-S4-A they were six
  // local $state fields; now UI / AI / kernel agree on snap state via OSMODE
  // / SNAPMODE / GRIDMODE / ORTHOMODE / AUTOSNAP. The reactivity nudge
  // _sysvarsRev re-runs getter-derived UI when a setter writes through —
  // it's NOT a state mirror (does not store the values themselves).
  private _sysvarsRev = $state(0);

  // OSNAP toggle (F3) — OSMODE bit 16384 = "running OSNAP off" flag.
  get snapEnabled(): boolean {
    void this._sysvarsRev;
    return this.kernel ? snapEnabledFromOsmode(readSysvarInt(this.kernel, 'OSMODE')) : true;
  }
  set snapEnabled(value: boolean) {
    if (!this.kernel) return;
    const cur = readSysvarInt(this.kernel, 'OSMODE');
    writeSysvarInt(this.kernel, 'OSMODE', setSnapEnabledOnOsmode(cur, value));
    this._sysvarsRev++;
  }

  // SNAP toggle (F9) — SNAPMODE 0/1.
  get gridSnapEnabled(): boolean {
    void this._sysvarsRev;
    return this.kernel ? modeFlagFromInt(readSysvarInt(this.kernel, 'SNAPMODE')) : false;
  }
  set gridSnapEnabled(value: boolean) {
    if (!this.kernel) return;
    writeSysvarInt(this.kernel, 'SNAPMODE', setModeFlagOnInt(value));
    this._sysvarsRev++;
  }

  // Modes
  // ORTHO toggle (F8) — ORTHOMODE 0/1.
  get orthoMode(): boolean {
    void this._sysvarsRev;
    return this.kernel ? modeFlagFromInt(readSysvarInt(this.kernel, 'ORTHOMODE')) : false;
  }
  set orthoMode(value: boolean) {
    if (!this.kernel) return;
    writeSysvarInt(this.kernel, 'ORTHOMODE', setModeFlagOnInt(value));
    this._sysvarsRev++;
  }

  // POLAR toggle (F10) — AUTOSNAP bit 16 (polar tracking).
  get polarEnabled(): boolean {
    void this._sysvarsRev;
    return this.kernel
      ? bitFromInt(readSysvarInt(this.kernel, 'AUTOSNAP'), AUTOSNAP_POLAR_TRACK_BIT)
      : false;
  }
  set polarEnabled(value: boolean) {
    if (!this.kernel) return;
    const cur = readSysvarInt(this.kernel, 'AUTOSNAP');
    writeSysvarInt(this.kernel, 'AUTOSNAP', setBitOnInt(cur, AUTOSNAP_POLAR_TRACK_BIT, value));
    this._sysvarsRev++;
  }

  polarIncrement = $state(15);

  // OTRACK toggle (F11) — AUTOSNAP bit 32 (object snap tracking).
  get otrackEnabled(): boolean {
    void this._sysvarsRev;
    return this.kernel
      ? bitFromInt(readSysvarInt(this.kernel, 'AUTOSNAP'), AUTOSNAP_OTRACK_BIT)
      : false;
  }
  set otrackEnabled(value: boolean) {
    if (!this.kernel) return;
    const cur = readSysvarInt(this.kernel, 'AUTOSNAP');
    writeSysvarInt(this.kernel, 'AUTOSNAP', setBitOnInt(cur, AUTOSNAP_OTRACK_BIT, value));
    this._sysvarsRev++;
  }

  acquiredSnapPoints: { x: number; y: number }[] = $state([]);
  dynInputEnabled = $state(true);

  // GRID toggle (F7) — GRIDMODE 0/1.
  get gridEnabled(): boolean {
    void this._sysvarsRev;
    return this.kernel ? modeFlagFromInt(readSysvarInt(this.kernel, 'GRIDMODE')) : true;
  }
  set gridEnabled(value: boolean) {
    if (!this.kernel) return;
    writeSysvarInt(this.kernel, 'GRIDMODE', setModeFlagOnInt(value));
    this._sysvarsRev++;
  }

  // Layer manager
  activeLayerId = $state('layer_0');
  layerManagerOpen = $state(false);

  // Units dialog
  unitsDialogOpen = $state(false);

  // Quick Select dialog
  quickSelectDialogOpen = $state(false);

  // Text style manager
  textStyleManagerOpen = $state(false);

  // Dim style manager
  dimStyleManagerOpen = $state(false);

  // MLeader style manager
  mleaderStyleManagerOpen = $state(false);

  // Table style manager
  tableStyleManagerOpen = $state(false);

  // Drawing properties dialog
  drawingPropertiesOpen = $state(false);

  // Properties panel
  propertiesPanelOpen = $state(true);

  // Design Center
  designCenterOpen = $state(false);

  // Agent panel
  agentPanelOpen = $state(false);

  // MText editor
  mtextEditorState = $state<{
    x: number;
    y: number;
    content: string;
    onSave: (content: string) => void;
    onCancel: () => void;
  } | null>(null);

  // Chat panel
  chatPanelOpen = $state(false);

  // Named views
  namedViews = $state<Map<string, { x: number; y: number; zoom: number }>>(new Map());

  // Workspace
  activeWorkspace = $state('full');

  // Ribbon docking
  ribbonDock = $state<'top' | 'float'>('top');
  ribbonFloatPos = $state({ x: 100, y: 100 });
  ribbonFloatWidth = $state(0);

  // Plugin manager
  pluginManagerOpen = $state(false);

  // Collaboration
  collabPanelOpen = $state(false);
  collaborators = $state<Array<{ name: string; color: string }>>([]);

  // Tool palettes panel
  toolPaletteOpen = $state(false);

  // Layouts / Paper Space
  layouts = $state<Array<{ id: string; name: string; paperWidth: number; paperHeight: number }>>([
    { id: 'layout1', name: 'Layout1', paperWidth: 297, paperHeight: 210 },
  ]);
  activeSpace = $state<'model' | 'paper'>('model');
  activeLayoutId = $state('layout1');

  // Xref manager
  xrefManagerOpen = $state(false);

  // Action recorder
  actionRecorderOpen = $state(false);

  // Status
  statusText = $state('Ready');
  mouseHints = $state<{ left: string; right: string }>({ left: 'Select', right: 'Context menu' });
  entityCount = $state(0);
  canUndo = $state(false);
  canRedo = $state(false);

  // Clipboard & history
  clipboard: string[] = $state([]);
  commandHistory: string[] = $state([]);

  // Last point for coordinate input
  lastPoint = $state<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection — owned by InteractionShell, wired via setSelection()
  private _selection: SelectionSet | null = null;

  get selection(): SelectionSet {
    if (!this._selection) {
      throw new Error('Selection not wired — call setSelection() after creating InteractionShell');
    }
    return this._selection;
  }

  setSelection(sel: SelectionSet): void {
    this._selection = sel;
    sel.setBus(this.bus);
    // Selection always reflects the current kernel; if a kernel is already
    // loaded by the time selection is wired, propagate immediately.
    if (this.kernel) sel.updateDeps({ kernel: this.kernel });
  }

  /**
   * Replace the active kernel and propagate the change to dependent state
   * (currently SelectionSet, which caches a kernel reference for selectAll
   * and similar reads). Use this whenever a new Kernel instance is created
   * — `handleNew`, opening a project, applying a template, etc. Direct
   * `app.kernel = new Kernel()` assignments bypass propagation and leave
   * selection.kernel stale, which silently breaks Ctrl+A and any other
   * code that reads kernel state via SelectionSet.
   */
  setKernel(kernel: NexusKernel | null): void {
    this.kernel = kernel;
    this._selection?.updateDeps({ kernel: kernel ?? undefined });
  }

  // Event bus — agent-ready protocol EventBus
  bus = new EventBus();

  constructor() {
    this.installBusListeners();
    this.restoreRibbonDock();
  }

  private restoreRibbonDock(): void {
    try {
      const saved = localStorage.getItem('nexus:ribbonDock');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dock === 'top' || parsed.dock === 'float') {
          this.ribbonDock = parsed.dock;
        }
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          this.ribbonFloatPos = { x: parsed.x, y: parsed.y };
        }
        if (typeof parsed.width === 'number' && parsed.width > 0) {
          this.ribbonFloatWidth = parsed.width;
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }

  saveRibbonDock(): void {
    try {
      localStorage.setItem(
        'nexus:ribbonDock',
        JSON.stringify({
          dock: this.ribbonDock,
          x: this.ribbonFloatPos.x,
          y: this.ribbonFloatPos.y,
          width: this.ribbonFloatWidth,
        }),
      );
    } catch {
      // ignore localStorage errors
    }
  }

  private installBusListeners(): void {
    this.bus.on('entities.created', () => this.syncEntities());
    this.bus.on('entities.modified', () => this.syncEntities());
    this.bus.on('entities.deleted', () => {
      this.syncEntities();
      this.reconcileSelection();
    });
    this.bus.on('layer.changed', () => this.syncLayers());
    this.bus.on('command.executed', (event) => {
      if (
        event.commandId.startsWith('CreateTextStyle') ||
        event.commandId.startsWith('ModifyTextStyle') ||
        event.commandId.startsWith('DeleteTextStyle') ||
        event.commandId.startsWith('SetCurrentTextStyle')
      ) {
        this.syncTextStyles();
      }
      if (
        event.commandId.startsWith('CreateDimStyle') ||
        event.commandId.startsWith('ModifyDimStyle') ||
        event.commandId.startsWith('DeleteDimStyle') ||
        event.commandId.startsWith('SetCurrentDimStyle')
      ) {
        this.syncDimStyles();
      }
      if (
        event.commandId.startsWith('CreateMLeaderStyle') ||
        event.commandId.startsWith('ModifyMLeaderStyle') ||
        event.commandId.startsWith('DeleteMLeaderStyle') ||
        event.commandId.startsWith('SetCurrentMLeaderStyle')
      ) {
        this.syncMLeaderStyles();
      }
      if (
        event.commandId.startsWith('CreateTableStyle') ||
        event.commandId.startsWith('ModifyTableStyle') ||
        event.commandId.startsWith('DeleteTableStyle') ||
        event.commandId.startsWith('SetCurrentTableStyle')
      ) {
        this.syncTableStyles();
      }
      // LTSCALE changes — refresh the renderer's dashed-pattern scale.
      if (
        event.commandId === 'SetLtscale' ||
        (event.commandId === 'SetSysvar' && /LTSCALE/i.test(event.payload?.toString() ?? ''))
      ) {
        this.syncLtscale();
      }
      if (event.commandId.startsWith('AddConstraint') || event.commandId === 'RemoveConstraint') {
        this.syncEntities();
      }
    });
  }

  initCloud() {
    this.authService = new AuthService();
    this.cloudStorage = new CloudStorageService();
    this.authService.init();
  }

  destroyCloud() {
    this.authService?.destroy();
    if (this.cloudSaveTimer) clearInterval(this.cloudSaveTimer);
  }

  enterGuestMode() {
    this.guestMode = true;
  }

  startCloudAutoSave() {
    if (this.cloudSaveTimer) clearInterval(this.cloudSaveTimer);
    this.cloudSaveTimer = setInterval(() => this.cloudAutoSave(), 300000);
  }

  private async cloudAutoSave() {
    if (!this.authService?.isAuthenticated || !this.cloudStorage || !this.kernel) return;
    if (this.kernel.entity_count() === 0) return;
    try {
      await this.saveToCloud();
      this.autoSaveStatus = `Cloud auto-saved ${new Date().toLocaleTimeString()}`;
    } catch {
      // silent — OPFS auto-save is the safety net
    }
  }

  private generateProjectId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async saveToCloud(): Promise<void> {
    if (!this.authService?.uid || !this.cloudStorage || !this.kernel) return;
    if (!this.cloudProjectId) {
      this.cloudProjectId = this.generateProjectId();
    }
    const { serializeProject } = await import('@nexus/file-io');
    const data = serializeProject(
      this.kernel.get_entities_json(),
      this.kernel.get_constraints_json(),
      { name: this.projectName },
    );
    await this.cloudStorage.saveProject(
      this.authService.uid,
      this.authService.user?.email || '',
      this.cloudProjectId,
      this.projectName,
      data,
      this.kernel.entity_count(),
      this.getLayers().length,
    );
  }

  get activeLayout() {
    return this.layouts.find((l) => l.id === this.activeLayoutId) ?? this.layouts[0];
  }

  addLayout(name?: string): void {
    const idx = this.layouts.length + 1;
    const id = `layout${Date.now()}`;
    this.layouts = [
      ...this.layouts,
      { id, name: name ?? `Layout${idx}`, paperWidth: 297, paperHeight: 210 },
    ];
    this.activeLayoutId = id;
    this.activeSpace = 'paper';
  }

  removeLayout(id: string): void {
    this.layouts = this.layouts.filter((l) => l.id !== id);
    if (this.activeLayoutId === id) {
      this.activeSpace = 'model';
      this.activeLayoutId = this.layouts[0]?.id ?? '';
    }
  }

  renameLayout(id: string, name: string): void {
    this.layouts = this.layouts.map((l) => (l.id === id ? { ...l, name } : l));
  }

  switchToModel(): void {
    this.activeSpace = 'model';
  }

  switchToLayout(id: string): void {
    const layout = this.layouts.find((l) => l.id === id);
    if (layout) {
      this.activeLayoutId = id;
      this.activeSpace = 'paper';
    }
  }

  getOrthoPoint(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): { x: number; y: number } {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  }

  get cursorPoint(): { x: number; y: number } {
    return this.hasSnap ? { x: this.snapX, y: this.snapY } : { x: this.cursorX, y: this.cursorY };
  }

  getLayerColors(): Map<string, string> {
    if (!this.kernel) return new Map([['default', '#ffffff']]);
    try {
      const layers: Layer[] = JSON.parse(this.kernel.get_layers_json());
      const map = new Map<string, string>();
      for (const l of layers) {
        map.set(l.id, l.color || '#ffffff');
      }
      if (!map.has('default')) map.set('default', '#ffffff');
      return map;
    } catch {
      return new Map([['default', '#ffffff']]);
    }
  }

  getLayers(): Array<{
    id: string;
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
    linetype: string | null;
    lineweight: number | null;
  }> {
    if (!this.kernel)
      return [
        {
          id: 'layer_0',
          name: '0',
          color: '#ffffff',
          visible: true,
          locked: false,
          linetype: null,
          lineweight: null,
        },
      ];
    try {
      return JSON.parse(this.kernel.get_layers_json());
    } catch {
      return [
        {
          id: 'layer_0',
          name: '0',
          color: '#ffffff',
          visible: true,
          locked: false,
          linetype: null,
          lineweight: null,
        },
      ];
    }
  }

  getLayerNames(): string[] {
    if (!this.kernel) return ['default'];
    try {
      const layers: Layer[] = JSON.parse(this.kernel.get_layers_json());
      return layers.map((l) => l.id);
    } catch {
      return ['default'];
    }
  }

  syncView() {
    if (!this.kernel || !this.renderer) return;
    // Skip full sync if no changes
    if (this.kernel && !this.kernel.has_changes()) {
      return;
    }
    const json = this.kernel.get_entities_json();
    const layerColors = this.getLayerColors();
    // Sync text + dim + mleader + table styles + ltscale to renderer
    this.syncTextStyles();
    this.syncDimStyles();
    this.syncMLeaderStyles();
    this.syncTableStyles();
    this.syncLtscale();
    const blockDefsJson = this.kernel.get_block_defs_json();
    this.renderer.syncEntities(json, layerColors, blockDefsJson);
    this.entityCount = this.kernel.entity_count();
    this.canUndo = this.kernel.can_undo();
    this.canRedo = this.kernel.can_redo();
    if (this.renderer.selectionManager?.selectedIds.size > 0) {
      this.renderer.updateSelection();
    }
    this.renderer.markDirty();
  }

  private syncEntities(): void {
    if (!this.kernel || !this.renderer) {
      console.warn('[syncEntities] skipped — kernel:', !!this.kernel, 'renderer:', !!this.renderer);
      return;
    }
    const json = this.kernel.get_entities_json();
    const entities = JSON.parse(json);
    if (entities.length > 0) {
      console.log(
        '[syncEntities] count:',
        entities.length,
        'first entity:',
        JSON.stringify(entities[0]).slice(0, 300),
      );
    }
    const layerColors = this.getLayerColors();
    const blockDefsJson = this.kernel.get_block_defs_json();
    this.renderer.syncEntities(json, layerColors, blockDefsJson);
    this.entityCount = this.kernel.entity_count();
    this.canUndo = this.kernel.can_undo();
    this.canRedo = this.kernel.can_redo();
    if (this.renderer.selectionManager?.selectedIds.size > 0) {
      this.renderer.updateSelection();
    }
    this.renderer.markDirty();
  }

  private syncLayers(): void {
    if (!this.kernel || !this.renderer) return;
    const json = this.kernel.get_entities_json();
    const layerColors = this.getLayerColors();
    const blockDefsJson = this.kernel.get_block_defs_json();
    this.renderer.syncEntities(json, layerColors, blockDefsJson);
    this.renderer.markDirty();
  }

  private syncTextStyles(): void {
    if (!this.kernel || !this.renderer) return;
    try {
      const styles: TextStyle[] = JSON.parse(this.kernel.get_text_styles_json());
      this.renderer.textStyles.clear();
      for (const s of styles) {
        this.renderer.textStyles.set(s.name, s);
      }
    } catch {
      // ignore parse errors
    }
  }

  private syncDimStyles(): void {
    if (!this.kernel || !this.renderer) return;
    try {
      const styles = JSON.parse(this.kernel.get_dim_styles_json()) as Array<{
        name: string;
        [k: string]: unknown;
      }>;
      this.renderer.dimStyles.clear();
      for (const s of styles) {
        // Renderer's DimStyleDef uses the same field names as the kernel.
        this.renderer.dimStyles.set(s.name, s as unknown as never);
      }
    } catch {
      // ignore parse errors
    }
  }

  private syncMLeaderStyles(): void {
    if (!this.kernel || !this.renderer) return;
    try {
      const styles = JSON.parse(this.kernel.get_mleader_styles_json()) as Array<{
        name: string;
        [k: string]: unknown;
      }>;
      this.renderer.mleaderStyles.clear();
      for (const s of styles) {
        this.renderer.mleaderStyles.set(s.name, s as unknown as never);
      }
    } catch {
      // ignore parse errors
    }
  }

  private syncTableStyles(): void {
    if (!this.kernel || !this.renderer) return;
    try {
      const styles = JSON.parse(this.kernel.get_table_styles_json()) as Array<{
        name: string;
        [k: string]: unknown;
      }>;
      this.renderer.tableStyles.clear();
      for (const s of styles) {
        this.renderer.tableStyles.set(s.name, s as unknown as never);
      }
    } catch {
      // ignore parse errors
    }
  }

  private syncLtscale(): void {
    if (!this.kernel || !this.renderer) return;
    try {
      const r = this.kernel.get_ltscale();
      if (r && typeof r === 'object' && 'measurement' in r) {
        const v = (r as { measurement?: number }).measurement;
        if (typeof v === 'number') {
          this.renderer.setLtscale(v);
        }
      }
    } catch {
      // ignore
    }
  }

  previewCommand(cmd: object): {
    success: boolean;
    preview_entities: Array<{ id: string; geometry: any }>;
  } {
    if (!this.kernel) return { success: false, preview_entities: [] };
    try {
      const resultJson = this.kernel.preview_command(JSON.stringify(cmd));
      return JSON.parse(resultJson);
    } catch {
      return { success: false, preview_entities: [] };
    }
  }

  previewCommands(cmds: object[]): Array<{ id: string; geometry: any }> {
    if (!this.kernel) return [];
    const allEntities: Array<{ id: string; geometry: any }> = [];
    for (const cmd of cmds) {
      try {
        const resultJson = this.kernel.preview_command(JSON.stringify(cmd));
        const result = JSON.parse(resultJson);
        if (result.success) allEntities.push(...result.preview_entities);
      } catch {
        // skip failed preview
      }
    }
    return allEntities;
  }

  executeCommand(command: object, source: EventSource = { type: 'human' }): CommandResult {
    if (!this.kernel) return { success: false, created_ids: [], error: 'Kernel not initialized' };
    const cmd = command as { type: string };
    try {
      const result: CommandResult = JSON.parse(
        this.kernel.execute_command(JSON.stringify(command)),
      );
      // Record action if recording is active
      if (actionRecorder.isRecording) {
        const { type: commandType, ...params } = command as Record<string, unknown>;
        actionRecorder.recordAction({
          commandType: commandType as string,
          params,
          timestamp: Date.now(),
        });
      }
      // Emit typed protocol event
      this.bus.emit('command.executed', {
        commandId: cmd.type,
        label: cmd.type,
        params: command as Record<string, unknown>,
        result: { success: result.success, created_ids: result.created_ids, error: result.error },
        source,
        timestamp: Date.now(),
      });
      // Emit granular entity events for backward compat
      const channels = resolveChannels(cmd);
      for (const ch of channels) {
        if (ch === 'entities:created')
          this.bus.emit('entities.created', { ids: result.created_ids || [] });
        else if (ch === 'entities:modified')
          this.bus.emit('entities.modified', { ids: result.created_ids || [] });
        else if (ch === 'entities:deleted') this.bus.emit('entities.deleted', { ids: [] });
        else if (ch === 'layers:changed')
          this.bus.emit('layer.changed', { layerId: '', change: 'modified' });
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown kernel error';
      this.statusText = `Command failed: ${msg}`;
      this.bus.emit('command.failed', { commandId: cmd.type, error: msg, source });
      return { success: false, created_ids: [], error: msg };
    }
  }

  undo() {
    if (this.kernel?.can_undo()) {
      this.kernel.undo();
      this.syncView();
      this.reconcileSelection();
      this.statusText = 'Undo';
    }
  }

  redo() {
    if (this.kernel?.can_redo()) {
      this.kernel.redo();
      this.syncView();
      this.reconcileSelection();
      this.statusText = 'Redo';
    }
  }

  private reconcileSelection(): void {
    if (!this._selection || !this.kernel) return;
    const selectedIds = this._selection.getIds();
    if (selectedIds.length === 0) return;
    try {
      const entities: Array<{ id: string }> = JSON.parse(this.kernel.get_entities_json());
      const entityIdSet = new Set(entities.map((e) => e.id));
      for (const id of selectedIds) {
        if (!entityIdSet.has(id)) {
          this._selection.deselect(id);
        }
      }
    } catch {
      // kernel not ready
    }
  }

  copySelected() {
    this.clipboard = this.selection.getSelectedIds();
    this.statusText = `Copied ${this.clipboard.length} entities`;
  }

  pasteClipboard() {
    if (this.clipboard.length === 0) return;
    const newIds: string[] = [];
    for (const id of this.clipboard) {
      const result = this.executeCommand({ type: 'CopyEntity', id });
      if (result.success) newIds.push(...result.created_ids);
    }
    if (newIds.length > 0) {
      for (const id of newIds) {
        this.executeCommand({ type: 'MoveEntity', id, dx: 10, dy: -10 });
      }
      this.selection.clear();
      for (const id of newIds) this.selection.toggle(id);
      this.statusText = `Pasted ${newIds.length} entities`;
    }
  }

  cutSelected() {
    this.copySelected();
    this.deleteSelected();
    this.statusText = `Cut ${this.clipboard.length} entities`;
  }

  pushCommandHistory(cmd: string) {
    this.commandHistory = [...this.commandHistory.slice(-49), cmd];
  }

  deleteSelected() {
    const ids = this.selection.getSelectedIds();
    for (const id of ids) {
      this.executeCommand({ type: 'DeleteEntity', id });
    }
    this.selection.clear();
    this.statusText = `Deleted ${ids.length} entities`;
  }

  formatLinear(value: number): string {
    return this.kernel?.format_linear(value) ?? value.toFixed(4);
  }

  formatAngular(valueRadians: number): string {
    return (
      this.kernel?.format_angular(valueRadians) ?? `${((valueRadians * 180) / Math.PI).toFixed(2)}°`
    );
  }

  getSysvar(name: string): number {
    return this.kernel?.get_sysvar(name) ?? 0;
  }

  setSysvar(name: string, value: number): void {
    this.kernel?.set_sysvar(name, value);
  }

  // --- File I/O ---

  async handleNew() {
    if (!this.kernel) return;
    const wasmModule = await import('@nexus/kernel');
    this.setKernel(new wasmModule.Kernel());
    this.selection.clear();
    this.projectName = 'untitled';
    this.cloudProjectId = this.generateProjectId();
    this.syncView();
    this.statusText = 'New project created';
  }

  async applyTemplate(template: DrawingTemplate): Promise<void> {
    await this.handleNew();
    if (!this.kernel) return;

    const units: DrawingUnits = {
      linear_type: template.units.linearType,
      linear_precision: template.units.linearPrecision,
      angular_type: template.units.angularType,
      angular_precision: template.units.angularPrecision,
      insertion_scale: template.units.insertionScale,
    };
    this.kernel.set_units_json(JSON.stringify(units));

    for (const layer of template.layers) {
      if (layer.name !== '0') {
        this.executeCommand({ type: 'CreateLayer', name: layer.name, color: layer.color });
      }
    }

    this.projectName = `New ${template.name}`;
    this.statusText = `Created from template: ${template.name}`;
  }

  async openFromCloud(json: string, projectId: string, projectName: string): Promise<void> {
    const { deserializeProject } = await import('@nexus/file-io');
    const parsed = deserializeProject(json);
    if (!parsed) {
      this.statusText = `Failed to parse cloud project: ${projectName}`;
      return;
    }
    const wasmModule = await import('@nexus/kernel');
    this.setKernel(new wasmModule.Kernel());
    for (const ent of parsed.entities) {
      this.importEntity(ent.geometry, ent.layer_id || 'default');
    }
    if (parsed.units) {
      this.kernel.set_units_json(JSON.stringify(parsed.units));
    }
    if (parsed.textStyles) {
      for (const ts of parsed.textStyles) {
        if (ts.name !== 'Standard') {
          this.kernel.execute_command(
            JSON.stringify({
              type: 'CreateTextStyle',
              name: ts.name,
              font_family: ts.font_family,
              height: ts.height,
              width_factor: ts.width_factor,
              oblique_angle: ts.oblique_angle,
              is_bold: ts.is_bold,
              is_italic: ts.is_italic,
            }),
          );
        }
      }
    }
    this.projectName = projectName;
    this.cloudProjectId = projectId;
    this.syncView();
    this.renderer?.zoomExtents();
    this.statusText = `Opened from cloud: ${projectName}`;
  }

  async handleOpen() {
    try {
      const { openFilePicker, deserializeProject, parseDxf, parseDxfFull } =
        await import('@nexus/file-io');
      const file = await openFilePicker('.dxf,.nexus,.json');
      if (!file || !this.kernel) return;

      if (file.name.endsWith('.nexus') || file.name.endsWith('.json')) {
        const project = deserializeProject(file.content);
        if (project) {
          const wasmModule = await import('@nexus/kernel');
          this.setKernel(new wasmModule.Kernel());
          for (const ent of project.entities) {
            this.importEntity(ent.geometry, ent.layer_id || 'default');
          }
          if (project.units) {
            this.kernel.set_units_json(JSON.stringify(project.units));
          }
          if (project.textStyles) {
            for (const ts of project.textStyles) {
              if (ts.name !== 'Standard') {
                this.kernel.execute_command(
                  JSON.stringify({
                    type: 'CreateTextStyle',
                    name: ts.name,
                    font_family: ts.font_family,
                    height: ts.height,
                    width_factor: ts.width_factor,
                    oblique_angle: ts.oblique_angle,
                    is_bold: ts.is_bold,
                    is_italic: ts.is_italic,
                  }),
                );
              }
            }
          }
          this.projectName = file.name.replace(/\.(nexus|json)$/, '');
          this.syncView();
          this.renderer?.zoomExtents();
          this.statusText = `Opened: ${file.name}`;
        }
      } else if (file.name.endsWith('.dxf')) {
        // Full parse exposes drawing properties + named views/UCS so we can
        // restore them through kernel commands (durability for the resources
        // added in A8/A9/A10/A11).
        const fullResult = parseDxfFull(file.content);
        void parseDxf;
        const wasmModule = await import('@nexus/kernel');
        this.setKernel(new wasmModule.Kernel());
        for (const ent of fullResult.entities) {
          this.importEntity(ent.geometry, ent.layer || 'default');
        }
        if (fullResult.dwgProps) {
          this.kernel.execute_command(
            JSON.stringify({ type: 'SetDwgProps', ...fullResult.dwgProps }),
          );
        }
        if (fullResult.namedViews) {
          for (const v of fullResult.namedViews) {
            this.kernel.execute_command(JSON.stringify({ type: 'SaveNamedView', ...v }));
          }
        }
        if (fullResult.namedUcs) {
          for (const u of fullResult.namedUcs) {
            this.kernel.execute_command(JSON.stringify({ type: 'SaveUcs', ...u }));
          }
        }
        if (fullResult.sysvars) {
          for (const [name, value] of Object.entries(fullResult.sysvars)) {
            this.kernel.set_sysvar_typed_json(name, JSON.stringify(value));
          }
          this._sysvarsRev++;
        }
        this.projectName = file.name.replace('.dxf', '');
        this.syncView();
        this.renderer?.zoomExtents();
        this.statusText = `Imported DXF: ${fullResult.entities.length} entities from ${file.name}`;
      }
    } catch (e) {
      this.statusText = `Open failed: ${e}`;
      showToast(`Open failed: ${e}`, 'error');
    }
  }

  async handleSave(isLocalAutoSave = false) {
    if (!this.kernel) return;
    try {
      const { saveProject, serializeProject } = await import('@nexus/file-io');
      const data = serializeProject(
        this.kernel.get_entities_json(),
        this.kernel.get_constraints_json(),
        { name: this.projectName },
        this.kernel.get_text_styles_json(),
        this.kernel.get_units_json(),
      );
      await saveProject(this.projectName, data);

      if (!isLocalAutoSave && this.authService?.isAuthenticated && this.cloudStorage) {
        await this.saveToCloud();
        this.autoSaveStatus = `Saved (cloud + local) ${new Date().toLocaleTimeString()}`;
        this.statusText = `Saved: ${this.projectName} (cloud + local)`;
      } else {
        this.autoSaveStatus = `Saved ${new Date().toLocaleTimeString()}`;
        this.statusText = `Saved: ${this.projectName}`;
      }
      if (!isLocalAutoSave) showToast('Project saved', 'success');
    } catch (e) {
      this.statusText = `Save failed: ${e}`;
      showToast(`Save failed: ${e}`, 'error');
    }
  }

  async handleSaveAs() {
    const name = prompt('Project name:', this.projectName);
    if (name) {
      this.projectName = name;
      await this.handleSave();
    }
  }

  async handleExportDxf() {
    if (!this.kernel) return;
    try {
      const { exportDxf, downloadFile } = await import('@nexus/file-io');
      const dxf = exportDxf(
        this.kernel.get_entities_json(),
        this.kernel.get_layers_json(),
        this.kernel.get_text_styles_json(),
        this.kernel.get_dim_styles_json(),
        this.kernel.get_dwg_props_json(),
        this.kernel.get_named_views_json(),
        this.kernel.get_named_ucs_json(),
        this.kernel.get_sysvars_json(),
      );
      downloadFile(dxf, `${this.projectName}.dxf`, 'application/dxf');
      this.statusText = `Exported: ${this.projectName}.dxf`;
      showToast('DXF exported', 'success');
    } catch (e) {
      this.statusText = `Export failed: ${e}`;
      showToast(`Export failed: ${e}`, 'error');
    }
  }

  async handleExportSvg() {
    if (!this.kernel) return;
    try {
      const { formatRegistry, downloadFile } = await import('@nexus/file-io');
      const svgAdapter = formatRegistry.get('svg');
      if (!svgAdapter?.export) return;
      const entities = JSON.parse(this.kernel.get_entities_json());
      const layers = JSON.parse(this.kernel.get_layers_json());
      const svg = svgAdapter.export(entities, layers) as string;
      downloadFile(svg, `${this.projectName}.svg`, 'image/svg+xml');
      this.statusText = `Exported: ${this.projectName}.svg`;
    } catch (e) {
      this.statusText = `Export failed: ${e}`;
    }
  }

  async handleExportPdf(options: {
    paperSize: 'a4' | 'a3' | 'letter';
    orientation: 'portrait' | 'landscape';
    scale?: number;
    viewBounds?: { minX: number; minY: number; maxX: number; maxY: number };
    showLineweights?: boolean;
  }) {
    if (!this.kernel) return;
    try {
      const { exportToPdf } = await import('$lib/export/PdfExporter');
      const entities = JSON.parse(this.kernel.get_entities_json());
      const layers = JSON.parse(this.kernel.get_layers_json());
      await exportToPdf(entities, layers, {
        ...options,
        title: this.projectName,
      });
      this.statusText = `Exported: ${this.projectName}.pdf`;
      showToast('PDF exported', 'success');
    } catch (e) {
      this.statusText = `PDF export failed: ${e}`;
      showToast(`PDF export failed: ${e}`, 'error');
      throw e;
    }
  }

  private importEntity(g: GeometryType, layer: string) {
    if (!this.kernel) return;
    if ('Point' in g) this.kernel.create_point(g.Point.position.x, g.Point.position.y, layer);
    else if ('Line' in g)
      this.kernel.create_line(g.Line.start.x, g.Line.start.y, g.Line.end.x, g.Line.end.y, layer);
    else if ('Circle' in g)
      this.kernel.create_circle(g.Circle.center.x, g.Circle.center.y, g.Circle.radius, layer);
    else if ('Arc' in g)
      this.kernel.create_arc(
        g.Arc.center.x,
        g.Arc.center.y,
        g.Arc.radius,
        g.Arc.start_angle,
        g.Arc.end_angle,
        layer,
      );
    else if ('Rectangle' in g)
      this.kernel.create_rectangle(
        g.Rectangle.origin.x,
        g.Rectangle.origin.y,
        g.Rectangle.width,
        g.Rectangle.height,
        layer,
      );
    else if ('Polyline' in g) {
      const coords = g.Polyline.vertices.flatMap((v) => [v.x, v.y]);
      this.kernel.create_polyline(JSON.stringify(coords), g.Polyline.closed, layer);
    } else if ('Text' in g)
      this.kernel.create_text(
        g.Text.position.x,
        g.Text.position.y,
        g.Text.content,
        g.Text.height,
        g.Text.rotation,
        layer,
      );
    else if ('Dimension' in g)
      this.kernel.create_dimension(
        g.Dimension.start.x,
        g.Dimension.start.y,
        g.Dimension.end.x,
        g.Dimension.end.y,
        g.Dimension.offset,
        layer,
      );
    else if ('Ellipse' in g)
      this.executeCommand({
        type: 'CreateEllipse',
        cx: g.Ellipse.center.x,
        cy: g.Ellipse.center.y,
        semi_major: g.Ellipse.semi_major,
        semi_minor: g.Ellipse.semi_minor,
        rotation: g.Ellipse.rotation,
        layer_id: layer,
      });
    else if ('Spline' in g)
      this.executeCommand({
        type: 'CreateSpline',
        control_points: g.Spline.control_points.map((p) => [p.x, p.y]),
        degree: g.Spline.degree,
        closed: g.Spline.closed,
        layer_id: layer,
      });
  }

  saveNamedView(name: string): void {
    if (!this.renderer || !this.kernel) {
      this.statusText = 'Cannot save view: renderer or kernel not initialized';
      return;
    }
    const center = this.renderer.getViewCenter();
    const zoom = this.renderer.getZoom();
    const r = this.executeCommand({
      type: 'SaveNamedView',
      name,
      center_x: center.x,
      center_y: center.y,
      zoom,
    });
    if (r.success) {
      // Mirror into local Map for fast UI access — kernel is the source of truth.
      this.namedViews.set(name, { x: center.x, y: center.y, zoom });
      this.statusText = `View saved: ${name}`;
    } else {
      this.statusText = r.error ?? `Failed to save view: ${name}`;
    }
  }

  restoreNamedView(name: string): void {
    if (!this.kernel || !this.renderer) {
      this.statusText = 'Cannot restore view: renderer or kernel not initialized';
      return;
    }
    // Read kernel state — survives session restarts and undo/redo.
    try {
      const views = JSON.parse(this.kernel.get_named_views_json()) as Array<{
        name: string;
        center_x: number;
        center_y: number;
        zoom: number;
      }>;
      const view = views.find((v) => v.name === name);
      if (!view) {
        this.statusText = `View not found: ${name}`;
        return;
      }
      this.renderer.setViewState(view.center_x, view.center_y, view.zoom);
      this.statusText = `View restored: ${name}`;
    } catch {
      this.statusText = `Failed to restore view: ${name}`;
    }
  }

  async autoSave() {
    if (this.kernel && this.kernel.entity_count() > 0) {
      await this.handleSave(true);
      this.autoSaveStatus = `Auto-saved ${new Date().toLocaleTimeString()}`;
    }
  }

  // --- Multi-Document Interface ---

  private serializeCurrentDocument(): string | undefined {
    if (!this.kernel) return undefined;
    try {
      return JSON.stringify({
        entities: this.kernel.get_entities_json(),
        constraints: this.kernel.get_constraints_json(),
        layers: this.kernel.get_layers_json(),
        textStyles: this.kernel.get_text_styles_json(),
        units: this.kernel.get_units_json(),
      });
    } catch {
      return undefined;
    }
  }

  private async restoreDocument(serialized: string): Promise<void> {
    if (!this.kernel) return;
    const wasmModule = await import('@nexus/kernel');
    const kernel = new wasmModule.Kernel();
    this.setKernel(kernel);

    try {
      const data = JSON.parse(serialized);
      const entities = JSON.parse(data.entities);
      for (const ent of entities) {
        if (ent.geometry) {
          this.importEntity(ent.geometry, ent.layer_id || 'default');
        }
      }
      if (data.units) {
        kernel.set_units_json(data.units);
      }
      if (data.textStyles) {
        const styles = JSON.parse(data.textStyles);
        for (const ts of styles) {
          if (ts.name !== 'Standard') {
            kernel.execute_command(
              JSON.stringify({
                type: 'CreateTextStyle',
                name: ts.name,
                font_family: ts.font_family,
                height: ts.height,
                width_factor: ts.width_factor,
                oblique_angle: ts.oblique_angle,
                is_bold: ts.is_bold,
                is_italic: ts.is_italic,
              }),
            );
          }
        }
      }
    } catch {
      // Failed to restore — start with empty kernel
    }
    this.syncView();
  }

  async newDocument(): Promise<void> {
    // Serialize current document state
    const currentDoc = this.documents.find((d) => d.id === this.activeDocumentId);
    if (currentDoc) {
      currentDoc.serializedState = this.serializeCurrentDocument();
    }

    const id = `doc_${this.nextDocNum++}`;
    const name = 'untitled';
    this.documents = [...this.documents, { id, name }];
    this.activeDocumentId = id;
    this.projectName = name;

    await this.handleNew();
    this.statusText = `New drawing: ${name}`;
  }

  async switchDocument(id: string): Promise<void> {
    if (id === this.activeDocumentId) return;
    const target = this.documents.find((d) => d.id === id);
    if (!target) return;

    // Save current state
    const currentDoc = this.documents.find((d) => d.id === this.activeDocumentId);
    if (currentDoc) {
      currentDoc.serializedState = this.serializeCurrentDocument();
    }

    this.activeDocumentId = id;
    this.projectName = target.name;

    if (target.serializedState) {
      await this.restoreDocument(target.serializedState);
    } else {
      await this.handleNew();
    }

    this.statusText = `Switched to: ${target.name}`;
  }

  async closeDocument(id: string): Promise<void> {
    if (this.documents.length <= 1) {
      // Last document — just reset it
      await this.handleNew();
      this.documents = [{ id: this.documents[0].id, name: 'untitled' }];
      this.projectName = 'untitled';
      return;
    }

    const idx = this.documents.findIndex((d) => d.id === id);
    if (idx === -1) return;

    this.documents = this.documents.filter((d) => d.id !== id);

    if (id === this.activeDocumentId) {
      // Switch to adjacent tab
      const nextIdx = Math.min(idx, this.documents.length - 1);
      const next = this.documents[nextIdx];
      this.activeDocumentId = next.id;
      this.projectName = next.name;

      if (next.serializedState) {
        await this.restoreDocument(next.serializedState);
      } else {
        await this.handleNew();
      }
    }
  }

  renameDocument(id: string, name: string): void {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return;
    doc.name = name;
    this.documents = [...this.documents]; // trigger reactivity
    if (id === this.activeDocumentId) {
      this.projectName = name;
    }
  }
}
