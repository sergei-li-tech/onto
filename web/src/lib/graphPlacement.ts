/** Matches default ELK node size in layoutElk.ts */
export const DEFAULT_ENTITY_NODE_WIDTH = 160;
export const DEFAULT_ENTITY_NODE_HEIGHT = 56;

export function viewportCenterScreenPoint(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function nodePositionForFlowCenter(
  center: { x: number; y: number },
  size: { width: number; height: number } = {
    width: DEFAULT_ENTITY_NODE_WIDTH,
    height: DEFAULT_ENTITY_NODE_HEIGHT,
  },
): { x: number; y: number } {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  };
}
