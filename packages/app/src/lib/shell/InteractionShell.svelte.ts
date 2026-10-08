import type { InputEvent } from './InputEvent';
import type { ToolHandler, ToolContext } from './ToolHandler';
import type { Vec2, MouseHints } from './types';
import { SelectionSet } from './SelectionSet.svelte';
import type { SelectionGate } from './SelectionSet.svelte';
import { parseCoordinate } from '../tools/coordinates';
import type { CommandRegistry, CommandDef } from '../commands/CommandRegistry';
import type { AppState } from '../stores/AppState.svelte';
import { GripEditHandler } from './tools/GripEditHandler';
import { ModifyToolHandler } from './ModifyToolHandler';
import { InputRouter } from './InputRouter';
import { KeymapResolver, formatBinding } from '../protocol/KeymapResolver';
import { DEFAULT_KEYMAP } from '../protocol/default-keymap';
import { snapToPolarAngle, isPolarClose } from '../tracking/polar';
import { findOtrackSnap, type TrackingGuide } from '../tracking/otrack';

export type InputMode = 'IDLE' | 'TOOL_ACTIVE' | 'TRANSPARENT' | 'CONTEXT_MENU' | 'DIALOG';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export interface InteractionShellConfig {
  commandRegistry: CommandRegistry;
  app: AppState;
}

// Keys that always pass through to viewport navigation regardless of mode
const PASS_THROUGH_KEYS = new Set([
  '+',
  '-',
  '=',
  'Home',
  'F1',
  'F2',
  'F3',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
]);

// AutoCAD's APERTURE sysvar default is 10 pixels — the size of the snap
// pickbox in screen pixels. Aperture must stay constant in pixels regardless
// of zoom, so we convert to world units at query time.
const APERTURE_PIXELS = 10;

export class InteractionShell {
  // Reactive state
  mode = $state<InputMode>('IDLE');
  prompt = $state('Command:');
  mouseHints = $state<MouseHints>({ left: 'Select', right: 'Context menu' });
  activeToolId = $state<string | null>(null);
  availableCommands = $state<string[]>([]);
  statusMessage = $state('');

  // Selection — single authoritative source
  selection: SelectionSet;

  // Active tool session
  private activeSession: ToolHandler | null = null;
  private suspendedSession: ToolHandler | null = null;
  private lastToolId: string | null = null;

  // Dependencies
  private commandRegistry: CommandRegistry;
  private _app: AppState;
  private keymapResolver: KeymapResolver;

  // Input router
  readonly router = new InputRouter();

  // OTRACK acquisition
  private otrackHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private otrackHoverCandidate: Vec2 | null = null;
  private activeTrackingGuides: TrackingGuide[] = [];

  // Callbacks
  onPointAccepted: ((pt: Vec2, prompt: string) => void) | null = null;

  constructor(config: InteractionShellConfig) {
    this.commandRegistry = config.commandRegistry;
    this._app = config.app;
    this.keymapResolver = new KeymapResolver(DEFAULT_KEYMAP);
    this.selection = new SelectionSet();
    this.installRouterHandlers();
  }

  getShortcutDisplay(commandId: string): string {
    const binding = this.keymapResolver.getBindingForCommand(commandId);
    if (binding) return formatBinding(binding);
    return this.commandRegistry.getShortcutLabel(commandId);
  }

  private installRouterHandlers(): void {
    // Escape handler — priority 500 (highest)
    this.router.register({
      id: 'escape',
      priority: 500,
      handle: (event: InputEvent): boolean => {
        if (event.type !== 'KEY_DOWN' || event.key !== 'Escape') return false;
        this.handleEscape();
        return true;
      },
    });

    // Active tool dispatch — priority 300
    this.router.register({
      id: 'active-tool',
      priority: 300,
      handle: (event: InputEvent): boolean => {
        if (this.mode !== 'TOOL_ACTIVE' || !this.activeSession) return false;
        return this.dispatchToTool(event);
      },
    });
  }

  /** Set status message and sync to app.statusText when idle */
  private setStatus(msg: string): void {
    this.statusMessage = msg;
    if (this.mode !== 'TOOL_ACTIVE') {
      this._app.statusText = msg || 'Command:';
    }
  }

  /** Update renderer/kernel refs (call after they become available) */
  updateDeps(): void {
    this.selection.updateDeps({
      renderer: this._app.renderer,
      kernel: this._app.kernel,
    });
  }

  /** The single entry point for ALL input */
  handleInput(event: InputEvent): void {
    // Step 0a: Handle snap resolution for all pointer moves
    if (event.type === 'POINTER_MOVE') {
      this.resolveSnap(event.worldX, event.worldY);
    }

    // Step 0b: Always pass-through events (zoom, pan, toggle shortcuts)
    if (this.isPassThrough(event)) {
      this.handlePassThrough(event);
      // POINTER_MOVE also feeds the tool for preview, so don't return
      if (event.type !== 'POINTER_MOVE') return;
    }

    // Step 1: Dialog active → feed to dialog
    if (this.mode === 'DIALOG') {
      // Future: dialog.handleInput(event)
      return;
    }

    // Step 2: Context menu active → close on any input
    if (this.mode === 'CONTEXT_MENU') {
      this.mode = this.activeSession ? 'TOOL_ACTIVE' : 'IDLE';
      return;
    }

    // Step 3+4: Router handles escape (priority 500) and active tool (priority 300)
    if (this.router.dispatch(event)) return;

    // Step 5: Global modifier combos (Ctrl+Z, Ctrl+C, etc.)
    if (event.type === 'KEY_DOWN' && (event.ctrlKey || event.metaKey)) {
      if (this.handleModifierCombo(event)) return;
    }

    // Step 6: Global command resolution (COMMAND_TEXT or KEY_DOWN shortcut)
    if (event.type === 'COMMAND_TEXT') {
      this.resolveGlobalCommand(event.text);
      return;
    }

    if (event.type === 'KEY_DOWN') {
      if (this.handleGlobalKeyDown(event)) return;
    }

    // Step 7: IDLE/no-tool click → selection
    if (this.mode === 'IDLE' && event.type === 'POINTER_DOWN' && event.button === 'left') {
      this.handleIdleClick(event);
      return;
    }

    // Step 7b: IDLE drag → window/crossing select
    if (this.mode === 'IDLE' && event.type === 'DRAG_END') {
      this.handleIdleDragEnd(event);
      return;
    }

    // Step 7c: Right click in IDLE → context menu
    if (this.mode === 'IDLE' && event.type === 'POINTER_DOWN' && event.button === 'right') {
      this.handleIdleRightClick(event);
      return;
    }

    // Step 8: Pointer move in IDLE — could be used for preselection hover
    if (this.mode === 'IDLE' && event.type === 'POINTER_MOVE') {
      this.handleIdlePointerMove(event);
      return;
    }
  }

  /** Set a tool by ID (from toolbar click, shortcut, or command) */
  setTool(id: string): void {
    this.cancelCurrentTool();

    const cmdDef = this.commandRegistry.resolve(id);
    if (!cmdDef) {
      this.setStatus(`Unknown tool: ${id}`);
      return;
    }

    // Normalize to canonical alias (e.g. 'l' → 'line', 'co' → 'copy')
    // so Toolbar active-state checks like `activeToolId === 'line'` work correctly
    const canonicalId = this.commandRegistry.canonicalAlias(id);

    // Commands with invoke() start an interactive tool session
    if (cmdDef.invoke) {
      const handler = cmdDef.invoke();
      this.startToolSession(handler, canonicalId);
      return;
    }

    // Non-interactive commands (like 'select') just stay in IDLE
    this.activeToolId = canonicalId;
    this.setStatus('Command:');
  }

  /** Cancel the current tool and return to IDLE */
  cancelCurrentTool(): void {
    if (this.activeSession) {
      this.activeSession.deactivate();
      this.activeSession = null;
    }
    this.activeToolId = null;
    this.mode = 'IDLE';
    this._app.acquiredSnapPoints = [];
    this.activeTrackingGuides = [];
    this.clearOtrackHover();
    this.updatePromptState();
  }

  /** Execute a command non-interactively (for AI agents / scripts) */
  executeCommand(
    id: string,
    params: Record<string, unknown>,
  ): { success: boolean; created_ids: string[]; error?: string } {
    const cmdDef = this.commandRegistry.resolve(id);
    if (cmdDef) {
      const result = cmdDef.execute(params);
      if (result && typeof result === 'object' && 'success' in result) {
        return result as { success: boolean; created_ids: string[]; error?: string };
      }
      return { success: true, created_ids: [] };
    }
    return { success: false, created_ids: [], error: `Unknown command: ${id}` };
  }

  /** Handle a transparent command (zoom/pan) that doesn't cancel the active tool */
  handleTransparentCommand(cmd: CommandDef): void {
    if (this.activeSession) {
      this.activeSession.suspend();
      this.suspendedSession = this.activeSession;
      this.activeSession = null;
    }
    const prevMode = this.mode;
    this.mode = 'TRANSPARENT';
    cmd.execute({});
    this.resumeFromTransparent();
    if (!this.activeSession && prevMode === 'IDLE') {
      this.mode = 'IDLE';
    }
  }

  /** Resume from a transparent command back to the suspended tool */
  resumeFromTransparent(): void {
    if (this.suspendedSession) {
      this.activeSession = this.suspendedSession;
      this.suspendedSession = null;
      this.activeSession.resume();
      this.mode = 'TOOL_ACTIVE';
      this.updatePromptState();
    } else {
      this.mode = 'IDLE';
    }
  }

  /** Install a layer lock selection gate (always active) */
  installLayerLockGate(): void {
    const kernel = this._app.kernel;
    if (!kernel) return;
    const gate: SelectionGate = {
      canSelect(entityId: string): boolean {
        try {
          const entityJson = kernel.get_entity_json(entityId);
          const entity = JSON.parse(entityJson);
          const layerId = entity.layer_id || entity.layer || 'default';
          const layersJson = kernel.get_layers_json();
          const layers = JSON.parse(layersJson);
          const layer = layers.find((l: { id: string; locked: boolean }) => l.id === layerId);
          return layer ? !layer.locked : true;
        } catch {
          return true;
        }
      },
      reason: 'Entity is on a locked layer',
    };
    this.selection.installGate(gate);
  }

  /** Get context-sensitive menu items based on current mode */
  getContextMenuItems(): ContextMenuItem[] {
    if (this.mode === 'TOOL_ACTIVE' && this.activeSession) {
      const cmds = this.activeSession.getAvailableCommands();
      const items: ContextMenuItem[] = cmds.map((c) => ({
        label: c,
        action: () => {
          if (this.activeSession) {
            this.activeSession.onCommandInput(this.activeSession.status, c.toLowerCase());
            this.updatePromptState();
          }
        },
      }));
      if (items.length > 0) {
        items.push({ label: '', action: () => {}, separator: true });
      }
      items.push({ label: 'Cancel', action: () => this.cancelCurrentTool() });
      return items;
    }

    if (this.selection.count > 0) {
      return [
        { label: 'Move', shortcut: 'M', action: () => this.setTool('move') },
        { label: 'Copy', shortcut: 'CO', action: () => this.setTool('copy') },
        { label: 'Rotate', shortcut: 'RO', action: () => this.setTool('rotate') },
        { label: 'Mirror', shortcut: 'MI', action: () => this.setTool('mirror') },
        { label: 'Scale', shortcut: 'SC', action: () => this.setTool('scale') },
        { label: '', action: () => {}, separator: true },
        {
          label: 'Delete',
          shortcut: 'Del',
          action: () => {
            const ids = this.selection.getIds();
            for (const id of ids) {
              this._app.executeCommand({ type: 'DeleteEntity', id });
            }
            this.selection.clear();
          },
        },
        { label: '', action: () => {}, separator: true },
        { label: 'Properties', action: () => {} },
      ];
    }

    return [
      {
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        action: () => this._app.undo(),
        disabled: !this._app.canUndo,
      },
      {
        label: 'Redo',
        shortcut: 'Ctrl+Shift+Z',
        action: () => this._app.redo(),
        disabled: !this._app.canRedo,
      },
      { label: '', action: () => {}, separator: true },
      {
        label: 'Zoom Extents',
        shortcut: 'F2',
        action: () => this._app.renderer?.zoomExtents(),
      },
      {
        label: 'Select All',
        shortcut: 'Ctrl+A',
        action: () => this.selection.selectAll(),
      },
    ];
  }

  /** Get the active tool handler (for external inspection) */
  getActiveHandler(): ToolHandler | null {
    return this.activeSession;
  }

  // --- Private: Tool session lifecycle ---

  private _activeCtx: ToolContext | null = null;

  private startToolSession(handler: ToolHandler, toolId: string): void {
    const ctx = this.createToolContext();
    this._activeCtx = ctx;
    handler.activate(ctx);
    this.activeSession = handler;
    this.activeToolId = toolId;
    this.lastToolId = toolId;
    this.mode = 'TOOL_ACTIVE';
    this.updatePromptState();
  }

  private createToolContext(): ToolContext {
    const app = this._app;
    return {
      executeCommand: (cmd: object) => this._app.executeCommand(cmd),
      get activeLayerId() {
        return app.activeLayerId;
      },
      renderer: this._app.renderer,
      lastPoint: this._app.lastPoint,
      undo: () => this._app.undo(),
      cancelCurrentTool: () => this.cancelCurrentTool(),
      getSelectedIds: () => this.selection.getIds(),
      getSysvar: (name: string) => this._app.getSysvar(name),
      setSysvar: (name: string, value: number) => this._app.setSysvar(name, value),
      lastModifiers: { shift: false, ctrl: false },
    };
  }

  // --- Private: Dispatch to active tool ---

  private dispatchToTool(event: InputEvent): boolean {
    const session = this.activeSession!;
    const status = session.status;

    switch (event.type) {
      case 'COORDINATE':
        this.feedCoordinateToTool(session, event.point);
        return true;

      case 'COMMAND_TEXT': {
        // Try coordinate parse first
        const lastPt = session.getLastPoint() ?? this._app.lastPoint;
        const coord = parseCoordinate(event.text, lastPt);
        if (coord) {
          this.feedCoordinateToTool(session, coord, true);
          return true;
        }
        // Try tool sub-command
        const lower = event.text.toLowerCase().trim();
        if (session.onCommandInput(status, lower)) {
          this.updatePromptState();
          return true;
        }
        // Fall through to global command resolution
        return false;
      }

      case 'POINTER_DOWN':
        if (event.button === 'left') {
          if (this._activeCtx) {
            this._activeCtx.lastModifiers = { shift: event.shiftKey, ctrl: event.ctrlKey };
          }
          this.feedCoordinateToTool(session, event.point);
          return true;
        }
        if (event.button === 'right') {
          session.onRightClick(status);
          this.updatePromptState();
          // If tool cancelled itself (status went to -1 or cancelCurrentTool called)
          if (!this.activeSession) {
            this.updatePromptState();
          }
          return true;
        }
        return false;

      case 'POINTER_MOVE': {
        const movePt = this.applyConstraints(this._app.cursorPoint, session.getLastPoint());
        session.onPointerMove(status, movePt, event.worldX, event.worldY);

        // Shell-managed preview via kernel (batched to single WASM call)
        if (session.getPreviewCommand) {
          const raw = session.getPreviewCommand(movePt);
          if (raw) {
            const cmds = Array.isArray(raw) ? raw : [raw];
            if (cmds.length === 1) {
              const result = this._app.previewCommand(cmds[0]);
              if (result.success && result.preview_entities.length > 0) {
                this._app.renderer?.setPreviewEntities(result.preview_entities);
              } else {
                this._app.renderer?.clearPreview();
              }
            } else {
              const result = this._app.previewCommands(cmds);
              if (result.length > 0) {
                this._app.renderer?.setPreviewEntities(result);
              } else {
                this._app.renderer?.clearPreview();
              }
            }
          } else {
            this._app.renderer?.clearPreview();
          }
        }
        return true;
      }

      case 'KEY_DOWN': {
        // Let tool try to handle the key
        const result = session.onKeyDown(status, event.key, event.raw);
        if (result === 'HANDLED') {
          this.updatePromptState();
          return true;
        }
        // Check if key matches a sub-command alias prefix
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const cmds = session.getAvailableCommands();
          const match = cmds.find((c) => c.toLowerCase().startsWith(event.key.toLowerCase()));
          if (match) {
            if (session.onCommandInput(status, match.toLowerCase())) {
              this.updatePromptState();
              return true;
            }
          }
        }
        return false;
      }

      case 'DRAG_START':
      case 'DRAG_MOVE':
        return false;

      case 'DRAG_END':
        if (session instanceof ModifyToolHandler && this._app.renderer) {
          const mode = event.end.x > event.start.x ? 'window' : 'crossing';
          const ids = this._app.renderer.selectByRect(
            event.start.x,
            event.start.y,
            event.end.x,
            event.end.y,
            mode,
          );
          if (session.handleDragSelect(ids)) {
            this.updatePromptState();
            return true;
          }
        }
        // Pick phase drag-select for tools with pickMode
        if (
          'pickMode' in session &&
          (session as any).pickMode &&
          'handlePickDragSelect' in session &&
          this._app.renderer
        ) {
          const mode = event.end.x > event.start.x ? 'window' : 'crossing';
          const ids = this._app.renderer.selectByRect(
            event.start.x,
            event.start.y,
            event.end.x,
            event.end.y,
            mode,
          );
          if (ids.length > 0 && typeof (session as any).handlePickDragSelect === 'function') {
            (session as any).handlePickDragSelect(ids);
            this.updatePromptState();
            return true;
          }
        }
        return false;

      default:
        return false;
    }
  }

  private applyConstraints(pt: Vec2, lastPt: Vec2 | null, fromTypedInput = false): Vec2 {
    // Typed coordinates bypass all drafting aids (AutoCAD semantics)
    if (fromTypedInput) return pt;
    if (this._app.orthoMode && lastPt) {
      return this._app.getOrthoPoint(lastPt, pt);
    }
    if (this._app.polarEnabled && lastPt) {
      const dist = Math.sqrt(
        (pt.x - lastPt.x) * (pt.x - lastPt.x) + (pt.y - lastPt.y) * (pt.y - lastPt.y),
      );
      if (dist > 1e-6 && isPolarClose(lastPt, pt, this._app.polarIncrement)) {
        return snapToPolarAngle(lastPt, pt, this._app.polarIncrement).point;
      }
    }
    return pt;
  }

  private feedCoordinateToTool(session: ToolHandler, point: Vec2, fromTypedInput = false): void {
    const pt = this.applyConstraints(point, session.getLastPoint(), fromTypedInput);
    const oldPrompt = session.getPrompt();
    session.onCoordinateInput(session.status, pt);
    this._app.lastPoint = pt;
    // Clear acquired otrack points on point accept
    this._app.acquiredSnapPoints = [];
    this.activeTrackingGuides = [];
    // F-2: a one-shot OSNAP override applies to exactly one pick. Once the
    // user commits a point, restore normal snap behavior for the next pick.
    if (this._app.renderer?.snapEngine) {
      this._app.renderer.snapEngine.oneShotOverride = null;
    }
    this.onPointAccepted?.(pt, oldPrompt);
    this.updatePromptState();
    if (fromTypedInput) {
      this._app.renderer?.ensurePointVisible(pt.x, pt.y);
    }
  }

  // --- Private: Pass-through handling ---

  private isPassThrough(event: InputEvent): boolean {
    if (event.type === 'WHEEL') return true;
    if (event.type === 'POINTER_DOWN' && event.button === 'middle') return true;
    if (event.type === 'KEY_DOWN' && PASS_THROUGH_KEYS.has(event.key)) return true;
    return false;
  }

  private handlePassThrough(event: InputEvent): void {
    if (event.type === 'KEY_DOWN') {
      const commandId = this.keymapResolver.resolve(event);
      if (commandId) {
        this.dispatchKeymapCommand(commandId);
      }
    }
    // Wheel and middle-button pan are handled by the renderer internally
  }

  // --- Private: Escape ---

  private handleEscape(): void {
    if (this.mode === 'CONTEXT_MENU') {
      this.mode = this.activeSession ? 'TOOL_ACTIVE' : 'IDLE';
      return;
    }
    if (this.mode === 'TOOL_ACTIVE' && this.activeSession) {
      // Let tool handle escape first (e.g., go back one status)
      const result = this.activeSession.onKeyDown(this.activeSession.status, 'Escape');
      if (result === 'HANDLED') {
        this.updatePromptState();
        return;
      }
      this.cancelCurrentTool();
      this.setStatus('Cancelled');
      return;
    }
    if (this.selection.count > 0) {
      this.selection.clear();
      this.setStatus('Command:');
      return;
    }
    this.setStatus('Cancelled');
  }

  // --- Private: Modifier combos ---

  private handleModifierCombo(event: InputEvent & { type: 'KEY_DOWN' }): boolean {
    const commandId = this.keymapResolver.resolve(event);
    if (!commandId) return false;
    return this.dispatchKeymapCommand(commandId);
  }

  private dispatchKeymapCommand(commandId: string): boolean {
    switch (commandId) {
      case 'undo':
        this._app.undo();
        return true;
      case 'redo':
        this._app.redo();
        return true;
      case 'select-all':
        this.selection.selectAll();
        this.setStatus(`Selected: ${this.selection.count} entities`);
        return true;
      case 'cut':
        this._app.cutSelected();
        return true;
      case 'copy':
        this._app.copySelected();
        return true;
      case 'paste':
        this._app.pasteClipboard();
        return true;
      case 'new-project':
        this._app.handleNew();
        return true;
      case 'open-file':
        this._app.handleOpen();
        return true;
      case 'save':
        this._app.handleSave();
        this.setStatus('');
        return true;
      case 'save-as':
        this._app.handleSaveAs();
        return true;
      case 'toggle-layer-manager':
        this._app.layerManagerOpen = !this._app.layerManagerOpen;
        return true;
      case 'delete-selected':
        if (this.selection.count > 0) {
          const ids = this.selection.getIds();
          for (const id of ids) {
            this._app.executeCommand({ type: 'DeleteEntity', id });
          }
          this.selection.clear();
          this.setStatus(`Deleted ${ids.length} entities`);
          return true;
        }
        return false;
      case 'cancel':
        this.cancelCurrentTool();
        return true;
      case 'zoom-extents':
        this._app.renderer?.zoomExtents();
        return true;
      case 'zoom-in':
        this._app.renderer?.zoomIn();
        return true;
      case 'zoom-out':
        this._app.renderer?.zoomOut();
        return true;
      case 'toggle-snap':
        this._app.snapEnabled = !this._app.snapEnabled;
        this.setStatus(`OSnap: ${this._app.snapEnabled ? 'ON' : 'OFF'}`);
        return true;
      case 'toggle-ortho':
        this._app.orthoMode = !this._app.orthoMode;
        if (this._app.orthoMode) this._app.polarEnabled = false;
        this.setStatus(`Ortho: ${this._app.orthoMode ? 'ON' : 'OFF'}`);
        return true;
      case 'toggle-grid':
        this._app.gridEnabled = !this._app.gridEnabled;
        this.setStatus(`Grid: ${this._app.gridEnabled ? 'ON' : 'OFF'}`);
        return true;
      case 'toggle-grid-snap':
        this._app.gridSnapEnabled = !this._app.gridSnapEnabled;
        this.setStatus(`Grid Snap: ${this._app.gridSnapEnabled ? 'ON' : 'OFF'}`);
        return true;
      case 'toggle-polar':
        this._app.polarEnabled = !this._app.polarEnabled;
        if (this._app.polarEnabled) this._app.orthoMode = false;
        this.setStatus(`Polar Tracking: ${this._app.polarEnabled ? 'ON' : 'OFF'}`);
        return true;
      case 'toggle-otrack':
        this._app.otrackEnabled = !this._app.otrackEnabled;
        if (!this._app.otrackEnabled) this._app.acquiredSnapPoints = [];
        this.setStatus(`Object Snap Tracking: ${this._app.otrackEnabled ? 'ON' : 'OFF'}`);
        return true;
      case 'toggle-dynamic-input':
        this._app.dynInputEnabled = !this._app.dynInputEnabled;
        this.setStatus(`Dynamic Input: ${this._app.dynInputEnabled ? 'ON' : 'OFF'}`);
        return true;
      case 'repeat-last-command':
        if (this.lastToolId && this.mode === 'IDLE') {
          this.setTool(this.lastToolId);
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  // --- Private: Global key down ---

  private handleGlobalKeyDown(event: InputEvent & { type: 'KEY_DOWN' }): boolean {
    // Resolve via keymap (Delete, Backspace, etc.)
    const commandId = this.keymapResolver.resolve(event);
    if (commandId) {
      const handled = this.dispatchKeymapCommand(commandId);
      if (handled) return true;
    }

    // Single-key tool shortcuts — route through command registry (only when no tool active)
    if (
      !this.activeSession &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const cmdDef = this.commandRegistry.resolve(event.key.toLowerCase());
      // Accept any registered command, not just interactive (`invoke`) ones.
      // setTool handles the execute-only case by setting activeToolId and
      // resetting status without entering a tool session — needed so SELECT
      // (alias 's') activates from a single keystroke without falling through
      // to the +page.svelte alphanumeric forward, which would re-focus
      // cmd-input and let autocomplete cover the canvas.
      if (cmdDef) {
        this.setTool(event.key.toLowerCase());
        return true;
      }

      // Forward to command line
      return false;
    }

    if (event.key === '/') {
      return false; // Let UI focus command line
    }

    return false;
  }

  // --- Private: Global command resolution ---

  private resolveGlobalCommand(text: string): void {
    const lower = text.toLowerCase().trim();
    if (!lower) return;

    // Special commands
    if (lower === 'esc') {
      this.cancelCurrentTool();
      this.setStatus('Cancelled');
      return;
    }

    // Try command registry
    const cmdDef = this.commandRegistry.resolve(lower);
    if (cmdDef) {
      if (cmdDef.transparent && this.mode === 'TOOL_ACTIVE') {
        this.handleTransparentCommand(cmdDef);
      } else if (cmdDef.invoke) {
        this.setTool(lower);
      } else {
        cmdDef.execute({});
        this.setStatus('');
      }
      this._app.pushCommandHistory(text);
      return;
    }

    // Try as coordinate (auto-start line tool if in IDLE)
    const coord = parseCoordinate(text, this._app.lastPoint);
    if (coord) {
      if (this.mode === 'IDLE') {
        this.setTool('line');
      }
      if (this.activeSession) {
        this.feedCoordinateToTool(this.activeSession, coord, true);
      }
      this._app.pushCommandHistory(text);
      return;
    }

    this.setStatus(`Unknown: ${text}`);
  }

  // --- Private: IDLE click selection ---

  private handleIdleClick(event: InputEvent & { type: 'POINTER_DOWN' }): void {
    if (!this._app.renderer) return;

    const hitId = this._app.renderer.hitTest(event.worldX, event.worldY);

    // Only check grips if clicking on an already-selected entity
    if (this.selection.count > 0 && hitId && this.selection.has(hitId)) {
      const gripHit = this._app.renderer.getGripAtPoint(event.worldX, event.worldY);
      if (gripHit) {
        const handler = new GripEditHandler(gripHit);
        this.startToolSession(handler, 'grip_edit');
        return;
      }
    }

    if (hitId) {
      if (event.shiftKey) {
        this.selection.toggle(hitId);
      } else {
        this.selection.select(hitId);
      }
      this.setStatus(`Selected: ${this.selection.count} entities`);
      this._app.pushCommandHistory(`${this.selection.count} found`);
    } else {
      this.selection.clear();
      this.setStatus('Command:');
    }
  }

  private handleIdleDragEnd(event: InputEvent & { type: 'DRAG_END' }): void {
    const mode = event.end.x > event.start.x ? 'window' : 'crossing';
    this.selection.selectByRect(event.start.x, event.start.y, event.end.x, event.end.y, mode);
    if (this.selection.count > 0) {
      this.setStatus(`Selected: ${this.selection.count} entities (${mode})`);
      this._app.pushCommandHistory(`${this.selection.count} found`);
    } else {
      this.setStatus('Command:');
    }
  }

  private handleIdleRightClick(event: InputEvent & { type: 'POINTER_DOWN' }): void {
    // Pre-select entity under cursor if nothing selected
    if (this.selection.isEmpty() && this._app.renderer) {
      const hitId = this._app.renderer.hitTest(event.worldX, event.worldY);
      if (hitId) this.selection.toggle(hitId);
    }
    this.mode = 'CONTEXT_MENU';
  }

  private handleIdlePointerMove(_event: InputEvent & { type: 'POINTER_MOVE' }): void {
    // Snap is already resolved in resolveSnap() called from handleInput step 0a
  }

  private resolveSnap(worldX: number, worldY: number): void {
    this._app.cursorX = worldX;
    this._app.cursorY = worldY;

    const renderer = this._app.renderer;
    if (!renderer) return;

    let snapX = worldX;
    let snapY = worldY;
    let hasSnap = false;
    let snapType = '';

    // Step 1: Object snap via kernel (uses spatial index)
    if (this._app.snapEnabled && this._app.kernel) {
      const fromPoint = this.activeSession?.getLastPoint() ?? null;
      const hasFrom = fromPoint !== null;
      const fromX = fromPoint?.x ?? 0;
      const fromY = fromPoint?.y ?? 0;
      const threshold = APERTURE_PIXELS / renderer.getPixelsPerWorldUnit();
      const gridSize = renderer.snapEngine.config.gridSize;

      // F-2: Shift+RClick OSNAP override constrains the next snap query to
      // exactly one type ('none' suppresses snapping entirely). The override
      // persists across mousemoves and is cleared on point-commit.
      const override = renderer.snapEngine.oneShotOverride;
      if (override === 'none') {
        renderer.setSnapIndicator(null);
        return;
      }
      const cfg = renderer.snapEngine.config.types;
      const types: string[] = [];
      if (override !== null) {
        types.push(override);
      } else {
        if (cfg.endpoint) types.push('endpoint');
        if (cfg.midpoint) types.push('midpoint');
        if (cfg.center) types.push('center');
        if (cfg.intersection) types.push('intersection');
        if (cfg.quadrant) types.push('quadrant');
        if (cfg.nearest) types.push('nearest');
        if (this._app.gridSnapEnabled) types.push('grid');
        if (hasFrom) types.push('perpendicular');
      }
      const snapTypes = types.join(',');

      const resultJson = this._app.kernel.find_all_snaps(
        worldX,
        worldY,
        fromX,
        fromY,
        hasFrom,
        threshold,
        gridSize,
        snapTypes,
      );
      const snap = resultJson !== 'null' ? JSON.parse(resultJson) : null;

      if (snap && snap.type !== 'grid') {
        hasSnap = true;
        snapX = snap.x;
        snapY = snap.y;
        snapType = snap.type;
        renderer.setSnapIndicator(snap);
      } else if (snap && snap.type === 'grid') {
        hasSnap = true;
        snapX = snap.x;
        snapY = snap.y;
        snapType = 'grid';
        renderer.setSnapIndicator(null);
      } else {
        renderer.setSnapIndicator(null);
      }
    }

    // Step 2: OTRACK — acquire snap points and check alignment
    if (this._app.otrackEnabled) {
      if (hasSnap && snapType !== 'grid') {
        this.tryAcquireSnapPoint({ x: snapX, y: snapY });
      } else {
        this.clearOtrackHover();
      }

      const otrackThreshold = renderer.snapEngine.config.tolerance / renderer.getZoom() || 10;
      const otrackResult = findOtrackSnap(
        { x: snapX, y: snapY },
        this._app.acquiredSnapPoints,
        otrackThreshold,
      );
      if (otrackResult && !hasSnap) {
        snapX = otrackResult.point.x;
        snapY = otrackResult.point.y;
        hasSnap = true;
        snapType = 'otrack';
        this.activeTrackingGuides = otrackResult.guides;
      } else if (!otrackResult) {
        this.activeTrackingGuides = [];
      }
    } else {
      this.activeTrackingGuides = [];
    }

    // Step 3: POLAR tracking
    const fromPoint = this.activeSession?.getLastPoint() ?? null;
    if (this._app.polarEnabled && fromPoint && !hasSnap) {
      const dist = Math.sqrt(
        (snapX - fromPoint.x) * (snapX - fromPoint.x) +
          (snapY - fromPoint.y) * (snapY - fromPoint.y),
      );
      if (dist > 1e-6) {
        const polar = snapToPolarAngle(fromPoint, { x: snapX, y: snapY }, this._app.polarIncrement);
        if (isPolarClose(fromPoint, { x: snapX, y: snapY }, this._app.polarIncrement)) {
          snapX = polar.point.x;
          snapY = polar.point.y;
          hasSnap = true;
          snapType = `polar ${polar.angle}°`;
          renderer.setPolarGuide(fromPoint, { x: snapX, y: snapY });
        } else {
          renderer.setPolarGuide(null, null);
        }
      }
    } else {
      renderer.setPolarGuide(null, null);
    }

    // Step 4: Render tracking guides
    renderer.setTrackingGuides(this.activeTrackingGuides);

    this._app.hasSnap = hasSnap;
    this._app.snapX = snapX;
    this._app.snapY = snapY;
    this._app.snapType = snapType;
  }

  private tryAcquireSnapPoint(pt: Vec2): void {
    // Check if already acquired (within small tolerance)
    const exists = this._app.acquiredSnapPoints.some(
      (p) => Math.abs(p.x - pt.x) < 1e-6 && Math.abs(p.y - pt.y) < 1e-6,
    );
    if (exists) {
      this.clearOtrackHover();
      return;
    }

    // Start hover timer if this is a new candidate
    if (
      !this.otrackHoverCandidate ||
      Math.abs(this.otrackHoverCandidate.x - pt.x) > 1e-6 ||
      Math.abs(this.otrackHoverCandidate.y - pt.y) > 1e-6
    ) {
      this.clearOtrackHover();
      this.otrackHoverCandidate = { x: pt.x, y: pt.y };
      this.otrackHoverTimer = setTimeout(() => {
        if (this.otrackHoverCandidate) {
          this._app.acquiredSnapPoints = [
            ...this._app.acquiredSnapPoints.slice(-6),
            this.otrackHoverCandidate,
          ];
        }
        this.otrackHoverCandidate = null;
        this.otrackHoverTimer = null;
      }, 100);
    }
  }

  private clearOtrackHover(): void {
    if (this.otrackHoverTimer) {
      clearTimeout(this.otrackHoverTimer);
      this.otrackHoverTimer = null;
    }
    this.otrackHoverCandidate = null;
  }

  // --- Private: Prompt/state update ---

  private updatePromptState(): void {
    if (this.activeSession && this.mode === 'TOOL_ACTIVE') {
      this.prompt = this.activeSession.getPrompt();
      this.mouseHints = this.activeSession.getMouseHints();
      this.availableCommands = this.activeSession.getAvailableCommands();
      // Sync to legacy AppState for components that still read from it
      this._app.statusText = this.prompt;
      this._app.mouseHints = this.mouseHints;
    } else {
      this.prompt = 'Command:';
      this.mouseHints = { left: 'Select', right: 'Context menu' };
      this.availableCommands = [];
      this._app.statusText = this.statusMessage || 'Command:';
      this._app.mouseHints = this.mouseHints;
    }
  }
}
