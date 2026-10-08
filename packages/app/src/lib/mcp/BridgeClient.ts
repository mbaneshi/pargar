import type { AppState } from '../stores/AppState.svelte';

const BRIDGE_URL = 'ws://localhost:3100';

export class BridgeClient {
  private ws: WebSocket | null = null;
  private app: AppState;
  private _connected = false;
  private attempted = false;

  constructor(app: AppState) {
    this.app = app;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    if (this.attempted) return;
    this.attempted = true;

    try {
      this.ws = new WebSocket(BRIDGE_URL);

      this.ws.onopen = () => {
        this._connected = true;
        this.app.statusText = 'MCP bridge connected';
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
      };

      this.ws.onerror = () => {
        // silent — MCP bridge is opt-in
      };
    } catch {
      // silent — MCP bridge is opt-in
    }
  }

  private handleMessage(msg: {
    id: number;
    type: string;
    command?: object;
    method?: string;
  }): void {
    if (msg.type === 'execute_command' && msg.command) {
      const result = this.app.executeCommand(msg.command, {
        type: 'agent',
        agentId: 'mcp-bridge',
        model: 'unknown',
      });
      this.send({ type: 'response', id: msg.id, result });
    } else if (msg.type === 'query') {
      let result = '{}';
      if (msg.method === 'get_entities' && this.app.kernel) {
        result = this.app.kernel.get_entities_json();
      } else if (msg.method === 'get_layers' && this.app.kernel) {
        result = this.app.kernel.get_layers_json();
      } else if (msg.method === 'get_active_layer') {
        result = JSON.stringify({ layer_id: this.app.activeLayerId });
      }
      this.send({ type: 'response', id: msg.id, result });
    }
  }

  private send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }
}
