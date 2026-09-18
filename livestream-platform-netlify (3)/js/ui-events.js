/**
 * Delegated UI action router.
 * Keeps dynamic templates free from inline JavaScript handlers.
 */
(function(window, document) {
  'use strict';

  if (window.__fycDelegatedActionsBound) return;
  window.__fycDelegatedActionsBound = true;

  const specialActions = {
    openAdminPanel() {
      window.App?.switchView?.('admin');
      window.App?.closeModal?.();
    },
    print() {
      window.print();
    }
  };

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-app-action]');
    if (!target) return;

    if (target.tagName === 'BUTTON' || target.tagName === 'A') {
      event.preventDefault();
    }
    if (target.dataset.stopPropagation === 'true') {
      event.stopPropagation();
    }

    const action = target.dataset.appAction;
    const arg = target.dataset.appArg;
    const handler = specialActions[action] || window.App?.[action];

    if (typeof handler !== 'function') {
      console.warn('Unknown delegated UI action:', action);
      return;
    }

    try {
      const originalLabel = target instanceof HTMLButtonElement ? target.textContent : '';
      const result = specialActions[action]
        ? handler.call(specialActions, event, target)
        : (arg !== undefined ? handler.call(window.App, arg) : handler.call(window.App));

      if (result && typeof result.then === 'function') {
        if (target instanceof HTMLButtonElement) {
          target.disabled = true;
          target.dataset.originalLabel = originalLabel;
        }
        result
          .catch(err => {
            console.error(`Action ${action} failed:`, err);
            window.UI?.toast?.(err.message || 'Action failed.', 'error');
          })
          .finally(() => {
            if (target instanceof HTMLButtonElement) target.disabled = false;
          });
      }
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      window.UI?.toast?.(err.message || 'Action failed.', 'error');
    }
  });
})(window, document);


document.addEventListener('click', (event) => {
  const backdrop = event.target.closest?.('[data-modal-backdrop]');
  if (backdrop && event.target === backdrop) {
    window.App?.closeModal?.();
  }
});


document.addEventListener('input', (event) => {
  const target = event.target;

  if (target?.matches?.('[data-weight-section][data-weight-key]')) {
    window.App?.onWeightChange?.(target.dataset.weightSection, target.dataset.weightKey, target.value);
  }

  if (target?.matches?.('[data-preview-target]')) {
    const preview = document.getElementById(target.dataset.previewTarget);
    if (preview) preview.textContent = target.value;
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;

  if (target?.matches?.('[data-weight-section][data-weight-key]')) {
    window.App?.commitWeightChange?.();
  }

  if (target?.matches?.('[data-reviewer-filter]')) {
    window.App?.filterReviewsByReviewer?.(target.value);
  }

  if (target?.matches?.('[data-review-host-select]')) {
    window.App?.onReviewHostChange?.(target.value);
  }
});
