// Lightweight DOM-ref bridge between the (non-React) NodeIndicator ProseMirror
// plugin and the (React) BlockHandler component.
//
// The pointermove handler runs on every animation frame while the mouse is
// over the editor. To avoid dispatching a ProseMirror meta transaction (and
// therefore a React re-render of BlockHandler) on every position change, the
// handler updates the BlockHandler's position directly via this ref. Only
// structural changes (the hovered block node actually changing) go through a
// dispatched transaction, which keeps React renders to block-transition events.

export interface BlockHandlerPositionRef {
  /** The fixed-positioned BlockHandler container element, or null when hidden. */
  el: HTMLElement | null
}

export const blockHandlerPosition: BlockHandlerPositionRef = { el: null }

const POSITION_OFFSET_X = 38

/**
 * Update the BlockHandler's CSS position directly (no React involved).
 * Called from the high-frequency pointermove path.
 */
export function setBlockHandlerPosition(rect: { left: number; top: number }): void {
  const el = blockHandlerPosition.el
  if (!el) return
  el.style.left = `${rect.left - POSITION_OFFSET_X}px`
  el.style.top = `${rect.top}px`
}
