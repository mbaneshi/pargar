// Shared types for AutoCAD parity models.
// One model file per command (e.g. offset.model.ts) imports these.

export type ParityModel = {
  command: string;
  aliases: string[];
  sysvars: string[];
  states: Record<string, StateSpec>;
  transitions: Transition[];
  invariants: Invariant[];
};

export type StateSpec = {
  /** Regex the command-line prompt must match when the command is in this state. */
  prompt: RegExp;
  description: string;
  /** Option keywords in square brackets, in order, e.g. ['Through', 'Erase', 'Layer']. */
  options: string[];
  /** Text inside angle brackets; may be literal or a dynamic reference. */
  default?: string;
};

export type Transition = {
  from: string;
  input: InputSpec;
  to: string;
  /** What changes in command state (not user-visible). */
  effect?: string;
  notes?: string;
};

export type InputSpec =
  | { kind: 'keyword'; value: string }
  | { kind: 'number'; unit?: 'distance' | 'angle' }
  | { kind: 'point'; via: 'pick' | 'coord' | 'relative' | 'polar' }
  | { kind: 'key'; value: string }
  | { kind: 'gesture'; value: string };

export type Invariant = {
  name: string;
  /** 'all' = every state in this command; otherwise the list of state names it applies to. */
  appliesTo: 'all' | string[];
  action: InputSpec;
  /** Human-readable assertion. Tests encode this more concretely. */
  assertion: string;
};
