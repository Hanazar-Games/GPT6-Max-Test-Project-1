import { setAttribute, setHidden } from './hud.js';

export function createSelectionList(list, key) {
  const buttons = new Map([...list.children].map(button => [button.dataset[key], button]));
  return {
    update({ selectedId, visibleIds, disabled = false, order }) {
      for (const [id, button] of buttons) {
        setAttribute(button, 'aria-pressed', id === selectedId);
        setHidden(button, !visibleIds.has(id));
        if (button.disabled !== disabled) button.disabled = disabled;
      }
      if (!order) return;
      let next = list.firstElementChild;
      for (const id of order) {
        const button = buttons.get(id);
        if (button === next) next = next.nextElementSibling;
        else list.insertBefore(button, next);
      }
    },
  };
}
