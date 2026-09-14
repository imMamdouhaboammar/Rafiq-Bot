import { useEffect, useState } from 'react';
import {
  calculateMobileViewportLayout,
  shouldUseSinglePaneChatLayout,
} from '../services/mobileViewportLayout.js';

const readSafeAreaBottom = (): number => {
  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const value = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return value;
};

const readLayout = () => {
  const viewport = window.visualViewport;
  const layoutHeight = window.innerHeight;
  const viewportHeight = viewport?.height || layoutHeight;
  const viewportOffsetTop = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  return {
    ...calculateMobileViewportLayout({
      layoutHeight,
      viewportHeight,
      viewportOffsetTop,
      safeAreaBottom: readSafeAreaBottom(),
    }),
    width,
    singlePane: shouldUseSinglePaneChatLayout(width),
  };
};

export const useVisualViewportLayout = () => {
  const [layout, setLayout] = useState(() => ({
    visibleHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
    keyboardInset: 0,
    composerBottom: 0,
    contentHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    singlePane: typeof window === 'undefined' ? false : shouldUseSinglePaneChatLayout(window.innerWidth),
  }));

  useEffect(() => {
    let frame: number | undefined;
    const update = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        setLayout(readLayout());
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return layout;
};
