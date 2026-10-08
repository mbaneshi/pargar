export interface TooltipData {
  text: string;
  shortcut?: string;
  description?: string;
}

let tooltipEl: HTMLDivElement | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
let expandTimer: ReturnType<typeof setTimeout> | undefined;

function ensureTooltipEl(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'nexus-tooltip';
  tooltipEl.style.cssText = `
    position: fixed;
    z-index: 10000;
    background: rgba(30, 30, 30, 0.95);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-sm);
    padding: var(--space-sm, 4px) var(--space-md, 8px);
    max-width: 250px;
    pointer-events: none;
    display: none;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 150ms ease-out, max-height 300ms ease-out;
    overflow: hidden;
  `;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function buildCompactHtml(data: TooltipData): string {
  let html = `<span style="font-size: var(--font-size-md, 12px); font-weight: 600; color: var(--color-text-bright, #fff);">${escapeHtml(data.text)}`;
  if (data.shortcut) {
    html += ` <span style="font-family: var(--font-mono, monospace); font-weight: 400; color: var(--color-text-secondary, #888);">(${escapeHtml(data.shortcut)})</span>`;
  }
  html += `</span>`;
  return html;
}

function buildExpandedHtml(data: TooltipData): string {
  let html = `<span style="font-size: var(--font-size-md, 12px); font-weight: 600; color: var(--color-text-bright, #fff);">${escapeHtml(data.text)}</span>`;
  if (data.shortcut) {
    html += `<span style="font-size: var(--font-size-sm, 11px); font-family: var(--font-mono, monospace); color: var(--color-text-secondary, #888);">${escapeHtml(data.shortcut)}</span>`;
  }
  html += `<hr style="border: none; border-top: 1px solid var(--color-border-input, #444); margin: 3px 0;" />`;
  html += `<div style="background: rgba(40, 40, 40, 0.6); border-radius: 2px; padding: 3px 4px; margin: 0 -2px;">`;
  if (data.description) {
    html += `<span style="font-size: var(--font-size-sm, 11px); color: var(--color-text-primary, #ccc); white-space: normal;">${escapeHtml(data.description)}</span>`;
  }
  html += `<span style="font-size: 10px; color: var(--color-text-muted, #666); margin-top: 2px; display: block;">Press F1 for help</span>`;
  html += `</div>`;
  return html;
}

function showTooltip(node: HTMLElement, data: TooltipData) {
  const el = ensureTooltipEl();
  const hasExtended = Boolean(data.description);

  el.innerHTML = buildCompactHtml(data);
  el.style.display = 'flex';
  el.style.opacity = '0';

  positionTooltip(el, node);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });

  if (hasExtended) {
    expandTimer = setTimeout(() => {
      el.innerHTML = buildExpandedHtml(data);
      positionTooltip(el, node);
    }, 1000);
  }
}

function positionTooltip(el: HTMLDivElement, node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < 80;

  const elRect = el.getBoundingClientRect();
  let left = centerX - elRect.width / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - elRect.width - 4));

  el.style.left = `${left}px`;
  if (above) {
    el.style.top = `${rect.top - 6 - elRect.height}px`;
  } else {
    el.style.top = `${rect.bottom + 6}px`;
  }
}

function hideTooltip() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
  }
  if (expandTimer) {
    clearTimeout(expandTimer);
    expandTimer = undefined;
  }
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
    tooltipEl.style.opacity = '0';
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function tooltip(node: HTMLElement, data: TooltipData) {
  function onEnter() {
    hoverTimer = setTimeout(() => showTooltip(node, data), 500);
  }

  function onLeave() {
    hideTooltip();
  }

  node.removeAttribute('title');
  node.addEventListener('pointerenter', onEnter);
  node.addEventListener('pointerleave', onLeave);
  node.addEventListener('pointerdown', onLeave);

  return {
    update(newData: TooltipData) {
      data = newData;
    },
    destroy() {
      hideTooltip();
      node.removeEventListener('pointerenter', onEnter);
      node.removeEventListener('pointerleave', onLeave);
      node.removeEventListener('pointerdown', onLeave);
    },
  };
}
