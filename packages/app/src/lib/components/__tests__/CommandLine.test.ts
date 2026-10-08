/**
 * CommandLine logic tests — extracted pure functions only.
 *
 * NOTE: @testing-library/svelte is NOT installed (not in devDependencies).
 * These tests verify the key state-machine logic inline rather than
 * rendering the component. A follow-up task should add @testing-library/svelte
 * as a devDependency and port these to full component tests.
 *
 * Logic under test: the `suggestionNavigated` flag that gates whether
 * Enter accepts a highlighted suggestion or fires the command directly.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── Extracted logic mirror ───────────────────────────────────────────────────
// This mirrors the state machine inside CommandLine.svelte so we can verify
// the branching behaviour without a DOM / Svelte runtime.

interface SearchItem {
  label: string;
  category: 'CMD' | 'LAYER' | 'BLOCK';
  value: string;
}

function buildSearchResults(val: string, commandAliases: string[]): SearchItem[] {
  const results: SearchItem[] = [];
  const cmdMatches = commandAliases.filter((a) => a.toLowerCase().startsWith(val));
  for (const m of cmdMatches) {
    results.push({ label: m, category: 'CMD', value: m });
  }
  return results;
}

interface State {
  commandText: string;
  suggestions: SearchItem[];
  selectedIndex: number;
  showSuggestions: boolean;
  suggestionNavigated: boolean;
}

function handleInput(state: State, commandAliases: string[]): State {
  const val = state.commandText.trim().toLowerCase();
  const next = { ...state, suggestionNavigated: false };
  if (val.length === 0) {
    return { ...next, showSuggestions: false, suggestions: [] };
  }
  const results = buildSearchResults(val, commandAliases);
  if (results.length > 0 && results.length <= 15) {
    return { ...next, suggestions: results, selectedIndex: 0, showSuggestions: true };
  }
  return { ...next, showSuggestions: false, suggestions: [] };
}

function handleArrowDown(state: State): State {
  if (state.showSuggestions) {
    return {
      ...state,
      suggestionNavigated: true,
      selectedIndex: Math.min(state.suggestions.length - 1, state.selectedIndex + 1),
    };
  }
  return state;
}

interface SubmitResult {
  state: State;
  commandFired: string | null;
  suggestionAccepted: string | null;
}

function handleSubmit(state: State, onCommand: (cmd: string) => void): SubmitResult {
  const cmd = state.commandText.trim();
  if (!cmd) {
    return { state, commandFired: null, suggestionAccepted: null };
  }

  if (state.showSuggestions && state.suggestions.length > 0 && state.suggestionNavigated) {
    const item = state.suggestions[state.selectedIndex];
    // CMD category: fill input, don't fire command yet
    const next: State = {
      ...state,
      commandText: item.value,
      showSuggestions: false,
      suggestionNavigated: false,
    };
    return { state: next, commandFired: null, suggestionAccepted: item.value };
  }

  // Normal path: fire the command
  onCommand(cmd);
  const next: State = {
    ...state,
    commandText: '',
    showSuggestions: false,
    suggestionNavigated: false,
  };
  return { state: next, commandFired: cmd, suggestionAccepted: null };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommandLine — Enter dispatches even with suggestions visible', () => {
  it('typing "L" + Enter fires onCommand("L") immediately', () => {
    const onCommand = vi.fn();
    const aliases = ['l', 'li', 'line', 'layer'];

    let state: State = {
      commandText: 'L',
      suggestions: [],
      selectedIndex: 0,
      showSuggestions: false,
      suggestionNavigated: false,
    };

    // Simulate oninput
    state = handleInput(state, aliases);
    expect(state.showSuggestions).toBe(true);
    expect(state.suggestionNavigated).toBe(false);

    // Simulate Enter (no arrow navigation)
    const result = handleSubmit(state, onCommand);
    expect(onCommand).toHaveBeenCalledWith('L');
    expect(result.state.commandText).toBe('');
  });

  it('typing full word "LINE" + Enter fires onCommand("LINE")', () => {
    const onCommand = vi.fn();
    const aliases = ['l', 'li', 'line'];

    let state: State = {
      commandText: 'LINE',
      suggestions: [],
      selectedIndex: 0,
      showSuggestions: false,
      suggestionNavigated: false,
    };

    state = handleInput(state, aliases);
    handleSubmit(state, onCommand);
    expect(onCommand).toHaveBeenCalledWith('LINE');
  });

  it('arrow-down to select suggestion, then Enter accepts the suggestion (does NOT call onCommand)', () => {
    const onCommand = vi.fn();
    const aliases = ['line', 'layer'];

    let state: State = {
      commandText: 'l',
      suggestions: [],
      selectedIndex: 0,
      showSuggestions: false,
      suggestionNavigated: false,
    };

    // oninput
    state = handleInput(state, aliases);
    expect(state.showSuggestions).toBe(true);
    expect(state.suggestions.length).toBeGreaterThan(0);

    // ArrowDown
    state = handleArrowDown(state);
    expect(state.suggestionNavigated).toBe(true);

    // Enter
    const result = handleSubmit(state, onCommand);
    expect(onCommand).not.toHaveBeenCalled();
    expect(result.suggestionAccepted).toBeTruthy();
    // The suggestion value should be filled in (e.g. 'line' or 'layer')
    expect(['line', 'layer']).toContain(result.suggestionAccepted);
  });
});
