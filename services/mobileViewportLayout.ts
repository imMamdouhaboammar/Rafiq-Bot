export interface VisualViewportSnapshot {
  layoutHeight: number;
  viewportHeight: number;
  viewportOffsetTop: number;
  safeAreaBottom: number;
}

export interface MobileViewportLayout {
  visibleHeight: number;
  keyboardInset: number;
  composerBottom: number;
  contentHeight: number;
}

const finiteNonNegative = (value: number): number => (
  Number.isFinite(value) ? Math.max(0, value) : 0
);

export const calculateMobileViewportLayout = ({
  layoutHeight,
  viewportHeight,
  viewportOffsetTop,
  safeAreaBottom,
}: VisualViewportSnapshot): MobileViewportLayout => {
  const layout = finiteNonNegative(layoutHeight);
  const visible = Math.min(layout || Infinity, finiteNonNegative(viewportHeight));
  const offset = finiteNonNegative(viewportOffsetTop);
  const safeBottom = finiteNonNegative(safeAreaBottom);
  const obscuredBottom = Math.max(0, layout - visible - offset);
  const keyboardInset = Math.max(0, obscuredBottom - safeBottom);

  return {
    visibleHeight: visible === Infinity ? layout : visible,
    keyboardInset,
    composerBottom: safeBottom + keyboardInset,
    contentHeight: Math.max(0, visible - safeBottom),
  };
};

export const shouldUseSinglePaneChatLayout = (width: number): boolean => (
  Number.isFinite(width) && width < 768
);
