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
      const result = specialActions[action]
        ? handler.call(specialActions, event, target)
        : (arg !== undefined ? handler.call(window.App, arg) : handler.call(window.App));

      if (result && typeof result.catch === 'function') {
        result.catch(err => console.error(`Action ${action} failed:`, err));
      }
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    }
  });
})(window, document);
