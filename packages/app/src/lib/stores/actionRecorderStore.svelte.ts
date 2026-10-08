import type { AppState } from './AppState.svelte';

export interface RecordedAction {
  commandType: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export class ActionRecorderStore {
  isRecording = $state(false);
  isPlaying = $state(false);
  recordedActions = $state<RecordedAction[]>([]);

  startRecording(): void {
    this.recordedActions = [];
    this.isRecording = true;
  }

  stopRecording(): void {
    this.isRecording = false;
  }

  recordAction(action: RecordedAction): void {
    if (!this.isRecording) return;
    this.recordedActions = [...this.recordedActions, action];
  }

  async playback(app: AppState): Promise<void> {
    if (this.isPlaying || this.recordedActions.length === 0) return;
    this.isPlaying = true;
    for (const action of this.recordedActions) {
      app.executeCommand({ type: action.commandType, ...action.params });
    }
    this.isPlaying = false;
  }
}

export const actionRecorder = new ActionRecorderStore();
