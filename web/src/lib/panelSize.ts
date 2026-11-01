/** Panel width after resizing: clamped to minimum and does not collapse center. */
export function nextPanelWidth(
  proposed: number,
  min: number,
  available: number,
  other: number,
  centerMin: number,
): number {
  const max = Math.max(min, available - other - centerMin);
  return Math.min(Math.max(proposed, min), max);
}
