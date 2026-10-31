// Shared by every animation. Motion may reveal the card, never move or resize it.
export const ALERT_LAYOUT = Object.freeze({ x: 710, y: 650, width: 790, height: 230 });
export function placeAlertPanel(panel) {
  const { x, y, width, height } = ALERT_LAYOUT;
  Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, transform: 'none' });
}
