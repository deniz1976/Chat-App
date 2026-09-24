const HIGHLIGHT_MS = 1600;

export const focusMessage = (root: ParentNode | null, messageId: string): boolean => {
  const target = root?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!target) {
    return false;
  }
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('highlighted');
  window.setTimeout(() => target.classList.remove('highlighted'), HIGHLIGHT_MS);
  return true;
};
