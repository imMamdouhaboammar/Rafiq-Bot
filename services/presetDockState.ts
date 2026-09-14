export type DockAnchor = 'left' | 'right';

export interface PresetDockState {
  visible: boolean;
  collapsed: boolean;
  anchor: DockAnchor;
  offsetY: number;
}

export interface DockViewport {
  width: number;
  height: number;
  headerHeight: number;
  composerHeight: number;
  dockHeight: number;
  edgePadding?: number;
}

export const DEFAULT_PRESET_DOCK_STATE: PresetDockState = {
  visible: true,
  collapsed: false,
  anchor: 'right',
  offsetY: 160,
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);

export const normalizePresetDockState = (
  state: PresetDockState,
  viewport: DockViewport,
): PresetDockState => {
  const edgePadding = viewport.edgePadding ?? 12;
  const minimumY = viewport.headerHeight + edgePadding;
  const maximumY = Math.max(
    minimumY,
    viewport.height - viewport.composerHeight - viewport.dockHeight - edgePadding,
  );
  return {
    visible: Boolean(state.visible),
    collapsed: Boolean(state.collapsed),
    anchor: state.anchor === 'left' ? 'left' : 'right',
    offsetY: clamp(Number.isFinite(state.offsetY) ? state.offsetY : minimumY, minimumY, maximumY),
  };
};

export const snapPresetDockToEdge = ({
  pointerX,
  pointerY,
  viewport,
  current,
}: {
  pointerX: number;
  pointerY: number;
  viewport: DockViewport;
  current: PresetDockState;
}): PresetDockState => normalizePresetDockState({
  ...current,
  anchor: pointerX < viewport.width / 2 ? 'left' : 'right',
  offsetY: pointerY - viewport.dockHeight / 2,
}, viewport);

export const movePresetDockByKeyboard = (
  state: PresetDockState,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  viewport: DockViewport,
  step = 16,
): PresetDockState => {
  if (key === 'ArrowLeft') return normalizePresetDockState({ ...state, anchor: 'left' }, viewport);
  if (key === 'ArrowRight') return normalizePresetDockState({ ...state, anchor: 'right' }, viewport);
  const direction = key === 'ArrowUp' ? -1 : 1;
  return normalizePresetDockState({ ...state, offsetY: state.offsetY + direction * step }, viewport);
};

export const serializePresetDockState = (state: PresetDockState): string => JSON.stringify({
  visible: state.visible,
  collapsed: state.collapsed,
  anchor: state.anchor,
  offsetY: Math.round(state.offsetY),
});

export const parsePresetDockState = (value: string | null): PresetDockState => {
  if (!value) return { ...DEFAULT_PRESET_DOCK_STATE };
  try {
    const parsed = JSON.parse(value) as Partial<PresetDockState>;
    return {
      visible: parsed.visible !== false,
      collapsed: parsed.collapsed === true,
      anchor: parsed.anchor === 'left' ? 'left' : 'right',
      offsetY: Number.isFinite(parsed.offsetY) ? Number(parsed.offsetY) : DEFAULT_PRESET_DOCK_STATE.offsetY,
    };
  } catch {
    return { ...DEFAULT_PRESET_DOCK_STATE };
  }
};
