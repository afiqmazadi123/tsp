/**
 * Shared production UI primitives: toasts, busy state, and static table sorting.
 */
(function(window, document) {
  'use strict';

  let toastRoot;
  let busyRoot;
  let busyDepth = 0;

  function ensureToastRoot() {
    if (toastRoot?.isConnected) return toastRoot;
    toastRoot = document.createElement('div');
    toastRoot.className = 'toast-stack';
    toastRoot.setAttribute('aria-live', 'polite');
    toastRoot.setAttribute('aria-atomic', 'false');
    document.body.appendChild(toastRoot);
    return toastRoot;
  }

  function toast(message, type = 'info', options = {}) {
    const root = ensureToastRoot();
    const item = document.createElement('div');
    const duration = Number(options.duration ?? 3600);
    item.className = `app-toast app-toast-${type}`;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i';
    item.innerHTML = `
      <span class="app-toast-icon" aria-hidden="true">${icon}</span>
      <span class="app-toast-message"></span>
      <button class="app-toast-close" type="button" aria-label="Dismiss notification">×</button>
    `;
    item.querySelector('.app-toast-message').textContent = String(message || '');
    const remove = () => {
      item.classList.add('leaving');
      window.setTimeout(() => item.remove(), 180);
    };
    item.querySelector('.app-toast-close').addEventListener('click', remove);
    root.appendChild(item);
    requestAnimationFrame(() => item.classList.add('visible'));
    if (duration > 0) window.setTimeout(remove, duration);
    return item;
  }

  function ensureBusyRoot() {
    if (busyRoot?.isConnected) return busyRoot;
    busyRoot = document.createElement('div');
    busyRoot.className = 'app-busy-overlay';
    busyRoot.hidden = true;
    busyRoot.innerHTML = `
      <div class="app-busy-card" role="status" aria-live="polite">
        <span class="app-spinner" aria-hidden="true"></span>
        <span class="app-busy-label">Working…</span>
      </div>
    `;
    document.body.appendChild(busyRoot);
    return busyRoot;
  }

  function beginBusy(label = 'Working…') {
    busyDepth += 1;
    const root = ensureBusyRoot();
    root.querySelector('.app-busy-label').textContent = label;
    root.hidden = false;
    document.documentElement.setAttribute('aria-busy', 'true');
  }

  function endBusy() {
    busyDepth = Math.max(0, busyDepth - 1);
    if (busyDepth > 0) return;
    const root = ensureBusyRoot();
    root.hidden = true;
    document.documentElement.removeAttribute('aria-busy');
  }

  async function withBusy(task, label) {
    beginBusy(label);
    try {
      return await task();
    } finally {
      endBusy();
    }
  }

  function parseSortValue(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return { type: 'text', value: '' };

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const time = Date.parse(raw);
      if (!Number.isNaN(time)) return { type: 'number', value: time };
    }

    const compact = raw
      .replace(/Rp\s?/gi, '')
      .replace(/%/g, '')
      .replace(/\b(hrs?|pcs|shifts?|sessions?)\b/gi, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .trim();

    if (/^-?\d+(?:\.\d+)?$/.test(compact)) {
      return { type: 'number', value: Number(compact) };
    }

    return { type: 'text', value: raw.toLocaleLowerCase('id-ID') };
  }

  function sortStaticTable(table, header) {
    if (!table || !header || header.dataset.noSort === 'true') return;
    const index = Array.from(header.parentElement.children).indexOf(header);
    if (index < 0) return;

    const tbody = table.tBodies?.[0];
    if (!tbody) return;

    const headers = Array.from(table.tHead?.rows?.[0]?.cells || []);
    headers.forEach(th => {
      if (th !== header) {
        th.removeAttribute('aria-sort');
        th.classList.remove('sort-active');
      }
    });

    const previous = header.getAttribute('aria-sort');
    const direction = previous === 'ascending' ? 'descending' : 'ascending';
    header.setAttribute('aria-sort', direction);
    header.classList.add('sort-active');

    const rows = Array.from(tbody.rows);
    const multiplier = direction === 'ascending' ? 1 : -1;

    rows.sort((a, b) => {
      const aCell = a.cells[index];
      const bCell = b.cells[index];
      const av = parseSortValue(aCell?.dataset.sortValue || aCell?.textContent);
      const bv = parseSortValue(bCell?.dataset.sortValue || bCell?.textContent);

      if (av.type === 'number' && bv.type === 'number') return (av.value - bv.value) * multiplier;
      return String(av.value).localeCompare(String(bv.value), 'id-ID', { numeric: true, sensitivity: 'base' }) * multiplier;
    });

    rows.forEach(row => tbody.appendChild(row));
  }

  function confirmAction(message, options = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="confirm-icon" aria-hidden="true">${options.icon || '!'}</div>
          <h3 id="confirm-title">${options.title || 'Confirm action'}</h3>
          <p class="confirm-message"></p>
          <div class="confirm-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-confirm-cancel>${options.cancelLabel || 'Cancel'}</button>
            <button type="button" class="apple-btn ${options.danger === false ? 'apple-btn-primary' : 'danger-btn'}" data-confirm-ok>${options.confirmLabel || 'Confirm'}</button>
          </div>
        </div>
      `;

      overlay.querySelector('.confirm-message').textContent = String(message || '');
      document.body.appendChild(overlay);
      const cancel = overlay.querySelector('[data-confirm-cancel]');
      const ok = overlay.querySelector('[data-confirm-ok]');

      const finish = value => {
        overlay.classList.add('leaving');
        window.setTimeout(() => overlay.remove(), 140);
        document.removeEventListener('keydown', onKeydown);
        resolve(value);
      };
      const onKeydown = event => {
        if (event.key === 'Escape') finish(false);
      };

      cancel.addEventListener('click', () => finish(false));
      ok.addEventListener('click', () => finish(true));
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish(false);
      });
      document.addEventListener('keydown', onKeydown);
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
        ok.focus();
      });
    });
  }

  document.addEventListener('click', event => {
    const header = event.target.closest?.('table[data-sortable="true"] thead th');
    if (!header) return;
    if (/action/i.test(header.textContent || '')) return;
    sortStaticTable(header.closest('table'), header);
  });

  window.UI = {
    toast,
    beginBusy,
    endBusy,
    withBusy,
    confirm: confirmAction,
    sortStaticTable
  };
})(window, document);
