import Quill from 'quill';
import { validateAndNormalizeUrl } from './urlValidator';

// Global safeguard for Quill selection restore when editor/modal unmounts or detaches from DOM
if (typeof window !== 'undefined' && window.Selection && Selection.prototype.addRange) {
  const originalAddRange = Selection.prototype.addRange;
  Selection.prototype.addRange = function (range) {
    if (!range) return;
    try {
      return originalAddRange.call(this, range);
    } catch (err) {
      if (
        err &&
        (err.name === 'IndexSizeError' ||
         err.name === 'HierarchyRequestError' ||
         err.name === 'NotFoundError' ||
         (typeof err.message === 'string' && err.message.toLowerCase().includes("isn't in document")))
      ) {
        return;
      }
      throw err;
    }
  };
}

export function getOrCreateErrorEl(tooltip) {
  if (!tooltip || !tooltip.root) return null;
  let errorEl = tooltip.root.querySelector('.ql-tooltip-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'ql-tooltip-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.style.display = 'none';
    tooltip.root.appendChild(errorEl);
  }
  return errorEl;
}

export function showTooltipError(tooltip, message = 'Please enter a valid URL.') {
  if (!tooltip || !tooltip.root) return;
  const errorEl = getOrCreateErrorEl(tooltip);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  if (tooltip.textbox) {
    tooltip.textbox.classList.add('ql-input-error');
    tooltip.textbox.setAttribute('aria-invalid', 'true');
    tooltip.textbox.focus();
  }
  // Prevent tooltip from overflowing the bottom boundary of its container
  if (tooltip.quill && tooltip.quill.root && tooltip.root) {
    const container = tooltip.quill.root.parentElement || tooltip.quill.container;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const rootRect = tooltip.root.getBoundingClientRect();
      if (rootRect.bottom > containerRect.bottom - 8) {
        const overflow = rootRect.bottom - (containerRect.bottom - 8);
        const currentTop = parseFloat(tooltip.root.style.top) || 0;
        tooltip.root.style.top = `${Math.max(8, currentTop - overflow)}px`;
      }
    }
  }
}

export function hideTooltipError(tooltip) {
  if (!tooltip || !tooltip.root) return;
  const errorEl = tooltip.root.querySelector('.ql-tooltip-error');
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
  if (tooltip.textbox) {
    tooltip.textbox.classList.remove('ql-input-error');
    tooltip.textbox.removeAttribute('aria-invalid');
    tooltip.textbox.style.borderColor = '';
    tooltip.textbox.style.boxShadow = '';
  }
}

export function attachLinkValidation(tooltip) {
  if (!tooltip || !tooltip.root) return;

  getOrCreateErrorEl(tooltip);

  if (tooltip.__linkValidationAttached) return;
  tooltip.__linkValidationAttached = true;

  if (tooltip.textbox) {
    const clearError = () => hideTooltipError(tooltip);
    tooltip.textbox.addEventListener('input', clearError);
    tooltip.textbox.addEventListener('paste', clearError);
    tooltip.textbox.addEventListener('cut', clearError);
  }

  // Intercept edit
  const originalEdit = tooltip.edit;
  tooltip.edit = function (mode = 'link', preview = null) {
    hideTooltipError(this);
    const res = originalEdit.apply(this, arguments);
    getOrCreateErrorEl(this);
    return res;
  };

  // Intercept hide
  const originalHide = tooltip.hide;
  tooltip.hide = function () {
    hideTooltipError(this);
    return originalHide.apply(this, arguments);
  };

  // Intercept cancel
  if (typeof tooltip.cancel === 'function') {
    const originalCancel = tooltip.cancel;
    tooltip.cancel = function () {
      hideTooltipError(this);
      return originalCancel.apply(this, arguments);
    };
  }

  // Intercept save
  const originalSave = tooltip.save;
  tooltip.save = function () {
    const mode = this.root ? this.root.getAttribute('data-mode') : null;
    if (mode === 'link') {
      const rawValue = this.textbox ? this.textbox.value : '';
      const validation = validateAndNormalizeUrl(rawValue);

      if (!validation.isValid) {
        showTooltipError(this, validation.error || 'Please enter a valid URL.');
        return;
      }

      hideTooltipError(this);
      const normalizedUrl = validation.normalizedUrl;

      if (this.textbox) {
        this.textbox.value = normalizedUrl;
      }

      const scrollTop = this.quill.root.scrollTop;
      const range = this.linkRange || this.quill.getSelection(true) || (this.quill.selection && this.quill.selection.savedRange);

      if (this.linkRange) {
        this.quill.formatText(this.linkRange, 'link', normalizedUrl, 'user');
        delete this.linkRange;
      } else if (range && range.length > 0) {
        this.restoreFocus();
        this.quill.formatText(range.index, range.length, 'link', normalizedUrl, 'user');
      } else if (range) {
        this.restoreFocus();
        this.quill.insertText(range.index, normalizedUrl, 'link', normalizedUrl, 'user');
        this.quill.setSelection(range.index + normalizedUrl.length, 0, 'user');
      } else {
        this.restoreFocus();
        this.quill.format('link', normalizedUrl, 'user');
      }

      this.quill.root.scrollTop = scrollTop;
      this.textbox.value = '';
      this.hide();
      return;
    }

    return originalSave.apply(this, arguments);
  };
}

if (Quill) {
  try {
    const Tooltip = Quill.import('ui/tooltip');
    if (Tooltip && !Tooltip.__boundsPatched) {
      Tooltip.__boundsPatched = true;
      const originalPosition = Tooltip.prototype.position;

      Tooltip.prototype.position = function (reference) {
        const shift = originalPosition.call(this, reference);

        if (this.quill && this.quill.container && this.root) {
          const containerRect = this.quill.container.getBoundingClientRect();
          const rootRect = this.root.getBoundingClientRect();
          const currentLeft = parseFloat(this.root.style.left) || 0;

          // Prevent tooltip from overflowing the left boundary of its container
          if (rootRect.left < containerRect.left + 10) {
            const diff = containerRect.left + 10 - rootRect.left;
            this.root.style.left = `${currentLeft + diff}px`;
          }

          // Prevent tooltip from overflowing the right boundary of its container
          const updatedRootRect = this.root.getBoundingClientRect();
          if (updatedRootRect.right > containerRect.right - 10) {
            const diff = updatedRootRect.right - (containerRect.right - 10);
            this.root.style.left = `${Math.max(10, currentLeft - diff)}px`;
          }
        }

        return shift;
      };
    }

    const SnowTheme = Quill.import('themes/snow');
    if (SnowTheme && !SnowTheme.__linkValidationPatched) {
      SnowTheme.__linkValidationPatched = true;
      const originalExtendToolbar = SnowTheme.prototype.extendToolbar;
      SnowTheme.prototype.extendToolbar = function (toolbar) {
        originalExtendToolbar.call(this, toolbar);
        if (this.tooltip) {
          attachLinkValidation(this.tooltip);
        }
      };
    }
  } catch (err) {
    console.error('Error applying Quill patches:', err);
  }
}

export default Quill;
