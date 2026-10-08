<script lang="ts">
  import { untrack } from 'svelte';

  export interface SearchItem {
    label: string;
    category: 'CMD' | 'LAYER' | 'BLOCK';
    value: string;
  }

  let {
    onCommand,
    onRepeatLast,
    statusText = '',
    commandAliases = [] as string[],
    layerNames = [] as string[],
    blockNames = [] as string[],
    activeToolId = '',
    onLayerSelect,
    onBlockSelect,
  }: {
    onCommand: (cmd: string) => void;
    onRepeatLast?: () => void;
    statusText?: string;
    commandAliases?: string[];
    layerNames?: string[];
    blockNames?: string[];
    activeToolId?: string;
    onLayerSelect?: (layerId: string) => void;
    onBlockSelect?: (blockName: string) => void;
  } = $props();

  let commandHistory = $state<{ text: string; type: 'input' | 'prompt' | 'echo' }[]>([]);
  let inputHistory = $state<string[]>([]);
  let historyIndex = $state(-1);
  let commandText = $state('');
  let suggestions = $state<SearchItem[]>([]);
  let selectedIndex = $state(0);
  let showSuggestions = $state(false);
  let suggestionNavigated = $state(false);
  let inputEl: HTMLInputElement;
  let historyEl: HTMLDivElement;
  let areaHeight = $state(90);

  const MAX_HISTORY = 100;
  const MIN_HEIGHT = 54;
  const MAX_HEIGHT = 250;

  let visibleHistory = $derived(commandHistory.slice(-10));

  const promptText = $derived.by(() => {
    if (!activeToolId || activeToolId === 'select') return 'Command:';
    return statusText || `${activeToolId.toUpperCase()}:`;
  });

  $effect(() => {
    if (statusText) {
      untrack(() => {
        // Only auto-push informational messages (no tool active)
        // Tool prompts show in the input row and combine with input in history
        if (!activeToolId || activeToolId === 'select') {
          pushHistory(statusText, 'prompt');
        }
      });
    }
  });

  $effect(() => {
    if (historyEl) {
      historyEl.scrollTop = historyEl.scrollHeight;
    }
  });

  interface ParsedPrompt {
    before: string;
    options: string[];
    after: string;
  }

  function parseOptions(text: string): ParsedPrompt | null {
    const match = text.match(/^(.*?)\[([^\]]+)\](.*)$/);
    if (!match) return null;
    return {
      before: match[1],
      options: match[2].split('/').map((o) => o.trim()),
      after: match[3],
    };
  }

  function pushHistory(line: string, type: 'input' | 'prompt' | 'echo') {
    commandHistory = [...commandHistory.slice(-(MAX_HISTORY - 1)), { text: line, type }];
  }

  function handleSubmit() {
    const cmd = commandText.trim();
    if (!cmd) {
      if (activeToolId && activeToolId !== 'select') {
        commandText = '';
        onCommand('');
      } else {
        onRepeatLast?.();
      }
      return;
    }

    if (showSuggestions && suggestions.length > 0 && suggestionNavigated) {
      const item = suggestions[selectedIndex];
      if (item.category === 'LAYER') {
        onLayerSelect?.(item.value);
        pushHistory(`Layer set: ${item.label}`, 'echo');
        commandText = '';
        showSuggestions = false;
        suggestionNavigated = false;
        return;
      } else if (item.category === 'BLOCK') {
        onBlockSelect?.(item.value);
        pushHistory(`INSERT block: ${item.label}`, 'echo');
        commandText = '';
        showSuggestions = false;
        suggestionNavigated = false;
        return;
      }
      commandText = item.value;
      showSuggestions = false;
      suggestionNavigated = false;
      return;
    }

    // Echo combined prompt + input for command log
    const currentPrompt = activeToolId && activeToolId !== 'select' ? statusText : 'Command:';
    pushHistory(`${currentPrompt} ${cmd}`, 'input');
    inputHistory.unshift(cmd);
    if (inputHistory.length > MAX_HISTORY) inputHistory.pop();
    historyIndex = -1;
    commandText = '';
    showSuggestions = false;
    suggestionNavigated = false;
    onCommand(cmd);
  }

  function handleOptionClick(option: string) {
    pushHistory(option, 'input');
    onCommand(option);
  }

  function buildSearchResults(val: string): SearchItem[] {
    const results: SearchItem[] = [];
    const cmdMatches = commandAliases.filter((a) => a.toLowerCase().startsWith(val));
    for (const m of cmdMatches) {
      results.push({ label: m, category: 'CMD', value: m });
    }
    const layerMatches = layerNames.filter((l) => l.toLowerCase().startsWith(val));
    for (const l of layerMatches) {
      results.push({ label: l, category: 'LAYER', value: l });
    }
    const blockMatches = blockNames.filter((b) => b.toLowerCase().startsWith(val));
    for (const b of blockMatches) {
      results.push({ label: b, category: 'BLOCK', value: b });
    }
    return results;
  }

  function handleInput() {
    suggestionNavigated = false;
    const val = commandText.trim().toLowerCase();
    if (val.length === 0) {
      showSuggestions = false;
      suggestions = [];
      return;
    }
    const results = buildSearchResults(val);
    if (results.length > 0 && results.length <= 15) {
      suggestions = results;
      selectedIndex = 0;
      showSuggestions = true;
    } else {
      showSuggestions = false;
      suggestions = [];
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions) {
        suggestionNavigated = true;
        selectedIndex = Math.max(0, selectedIndex - 1);
      } else if (inputHistory.length > 0) {
        historyIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
        commandText = inputHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        suggestionNavigated = true;
        selectedIndex = Math.min(suggestions.length - 1, selectedIndex + 1);
      } else if (historyIndex > 0) {
        historyIndex--;
        commandText = inputHistory[historyIndex];
      } else {
        historyIndex = -1;
        commandText = '';
      }
    } else if (e.key === 'Escape') {
      commandText = '';
      showSuggestions = false;
      // Release focus so the next keystroke routes to the global keymap and
      // can activate a tool (AutoCAD UX: Esc returns control to the canvas).
      // Keeping focus here lets typed characters open autocomplete which then
      // overlays the canvas and intercepts pointer events meant for selection
      // drag-end.
      inputEl?.blur();
      onCommand('esc');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const val = commandText.trim().toLowerCase();
      if (!val) return;
      const results = buildSearchResults(val);
      if (results.length === 1) {
        const item = results[0];
        if (item.category === 'LAYER') {
          onLayerSelect?.(item.value);
          pushHistory(`Layer set: ${item.label}`, 'echo');
          commandText = '';
        } else if (item.category === 'BLOCK') {
          onBlockSelect?.(item.value);
          pushHistory(`INSERT block: ${item.label}`, 'echo');
          commandText = '';
        } else {
          commandText = item.value;
        }
        showSuggestions = false;
      } else if (results.length > 1) {
        pushHistory(`  ${results.map((r) => `[${r.category}] ${r.label}`).join('  ')}`, 'echo');
        showSuggestions = false;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === ' ') {
      // AutoCAD muscle memory: Space submits when the buffer can't be a coord.
      // Submit cases: empty input, navigated autocomplete, or a buffer made
      // only of letters/digits/hyphens (covers L, LINE, REC, restore-view,
      // and digit-prefix commands like 3DFACE/2P if added later). Coord
      // shapes (comma, @, <) keep Space literal so "100, 100" or "@50<45"
      // continue to type normally.
      const trimmed = commandText.trim();
      if (showSuggestions && suggestionNavigated) {
        e.preventDefault();
        handleSubmit();
      } else if (trimmed.length === 0) {
        e.preventDefault();
        handleSubmit();
      } else if (/^(?=.*[a-zA-Z])[a-zA-Z0-9-]+$/.test(trimmed)) {
        e.preventDefault();
        handleSubmit();
      }
    }
  }

  function startResize(e: MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = areaHeight;

    function onMove(ev: MouseEvent) {
      const delta = startY - ev.clientY;
      areaHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + delta));
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  export function focus() {
    inputEl?.focus();
  }

  export function getInput(): HTMLInputElement {
    return inputEl;
  }

  export function echo(text: string, prompt?: string) {
    if (prompt) {
      pushHistory(`${prompt} ${text}`, 'input');
    } else {
      pushHistory(text, 'echo');
    }
  }

  export function focusWithKey(key: string) {
    commandText = key;
    inputEl?.focus();
    handleInput();
  }
</script>

<div class="command-area" style="height: {areaHeight}px" data-testid="command-area">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="resize-handle" onmousedown={startResize}></div>
  <div class="history" bind:this={historyEl}>
    {#each visibleHistory as entry, i (i)}
      <div
        class="history-line"
        class:input-line={entry.type === 'input'}
        class:echo-line={entry.type === 'echo'}
      >
        {#if entry.type === 'prompt'}
          {@const parsed = parseOptions(entry.text)}
          {#if parsed}
            <span>{parsed.before}</span><span class="bracket">[</span
            >{#each parsed.options as opt, i (i)}{#if i > 0}<span class="bracket">/</span
                >{/if}<button class="option-link" onclick={() => handleOptionClick(opt)}
                >{opt}</button
              >{/each}<span class="bracket">]</span><span>{parsed.after}</span>
          {:else}
            {entry.text}
          {/if}
        {:else if entry.type === 'input'}
          {entry.text}
        {:else}
          {entry.text}
        {/if}
      </div>
    {/each}
  </div>
  <div class="input-row">
    {#if parseOptions(promptText)}
      {@const parsed = parseOptions(promptText)}
      {#if parsed}
        <span class="prompt"
          >{parsed.before}<span class="bracket">[</span
          >{#each parsed.options as opt, i (i)}{#if i > 0}<span class="bracket">/</span>{/if}<button
              class="option-link"
              onclick={() => handleOptionClick(opt)}>{opt}</button
            >{/each}<span class="bracket">]</span>{parsed.after}</span
        >
      {/if}
    {:else}
      <span class="prompt">{promptText}</span>
    {/if}
    <div class="input-wrapper">
      {#if showSuggestions && suggestions.length > 0}
        <div class="autocomplete" class:interactive={suggestionNavigated}>
          {#each suggestions as item, i (i)}
            <button
              class="suggestion"
              class:selected={i === selectedIndex}
              onmousedown={(e) => {
                e.preventDefault();
                if (item.category === 'LAYER') {
                  onLayerSelect?.(item.value);
                  pushHistory(`Layer set: ${item.label}`, 'echo');
                  commandText = '';
                } else if (item.category === 'BLOCK') {
                  onBlockSelect?.(item.value);
                  pushHistory(`INSERT block: ${item.label}`, 'echo');
                  commandText = '';
                } else {
                  commandText = item.value;
                }
                showSuggestions = false;
                inputEl?.focus();
              }}
              ><span class="cat-label cat-{item.category.toLowerCase()}">{item.category}</span>
              {item.label}</button
            >
          {/each}
        </div>
      {/if}
      <input
        id="cmd-input"
        bind:this={inputEl}
        bind:value={commandText}
        oninput={handleInput}
        onkeydown={handleKeydown}
        placeholder="Type command or coordinates"
        spellcheck="false"
        autocomplete="off"
      />
    </div>
  </div>
</div>

<style>
  .command-area {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
    border-top: 1px solid var(--color-bg-input);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    color: var(--color-text-primary);
    min-height: var(--command-line-min-height);
    max-height: var(--command-line-max-height);
    position: relative;
  }

  .resize-handle {
    height: 4px;
    cursor: ns-resize;
    background: transparent;
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    z-index: var(--z-crosshair);
  }

  .resize-handle:hover {
    background: var(--color-accent-blue);
  }

  .history {
    padding: var(--space-xs) var(--space-md);
    overflow-y: auto;
    flex: 1;
  }

  .history-line {
    color: var(--color-text-secondary);
    white-space: nowrap;
    line-height: 1.5;
  }

  .history-line.input-line {
    color: var(--color-text-bright);
  }

  .history-line.echo-line {
    color: var(--color-text-muted);
  }

  .option-link {
    color: var(--color-link);
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
  }

  .option-link:hover {
    color: var(--color-link-hover);
  }

  .bracket {
    color: var(--color-text-secondary);
  }

  .input-row {
    display: flex;
    align-items: center;
    padding: var(--space-xs) var(--space-md);
    border-top: 1px solid var(--color-border-light);
  }

  .prompt {
    color: var(--color-text-secondary);
    margin-right: var(--space-sm);
    white-space: nowrap;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
  }

  .input-row input {
    background: transparent;
    border: none;
    color: var(--color-text-bright);
    font-family: inherit;
    font-size: inherit;
    width: 100%;
    outline: none;
    padding: var(--space-xs) 0;
  }

  .autocomplete {
    position: absolute;
    bottom: 100%;
    left: 0;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    max-height: 200px;
    overflow-y: auto;
    width: 250px;
    z-index: var(--z-dropdown);
    /*
     * Pointer-transparent by default so a canvas drag whose mouseup happens
     * to land inside the dropdown's screen rectangle isn't swallowed —
     * CadRenderer.onMouseUp must receive it to fire DRAG_END (#94).
     * Re-enabled only after the user signals intent to interact with the
     * dropdown by pressing ArrowUp/ArrowDown (suggestionNavigated). A pure
     * CSS :hover re-enable does not work: pointer-events: none disables the
     * hit-testing that drives :hover, so the rule never fires on the
     * default-transparent state. Hover-click without keyboard navigation
     * is therefore unsupported in this design — keyboard-first, matching
     * AutoCAD's command-line UX.
     */
    pointer-events: none;
  }
  .autocomplete * {
    pointer-events: none;
  }
  .autocomplete.interactive,
  .autocomplete.interactive * {
    pointer-events: auto;
  }

  .suggestion {
    display: block;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    color: var(--color-text-primary);
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
  }

  .suggestion:hover {
    background: var(--color-bg-input);
  }

  .suggestion.selected {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }

  .cat-label {
    display: inline-block;
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 2px;
    margin-right: 4px;
    vertical-align: middle;
    letter-spacing: 0.5px;
  }

  .cat-cmd {
    background: var(--color-accent-blue, #3b82f6);
    color: #fff;
  }

  .cat-layer {
    background: #16a34a;
    color: #fff;
  }

  .cat-block {
    background: #d97706;
    color: #fff;
  }

  @media (max-width: 768px) {
    .command-area {
      min-height: 36px;
      max-height: 36px;
      height: 36px !important;
    }
    .history {
      display: none;
    }
    .resize-handle {
      display: none;
    }
    .input-row {
      padding: var(--space-xs) var(--space-sm);
    }
    .input-row input {
      font-size: var(--font-size-sm);
    }
  }

  @media (max-width: 480px) {
    .prompt {
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .input-row input {
      font-size: 10px;
    }
  }
</style>
