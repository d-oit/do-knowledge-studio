import { useEffect, useRef } from 'react';
import Sigma from 'sigma';

interface TouchState {
  touches: Map<number, { x: number; y: number }>;
  initialPinchDistance: number;
  initialCameraRatio: number;
  initialCameraX: number;
  initialCameraY: number;
  isPanning: boolean;
  isPinching: boolean;
  lastPanX: number;
  lastPanY: number;
}

export function useGraphTouchGestures(
  container: HTMLDivElement | null,
  sigmaInstance: Sigma | null
) {
  const touchStateRef = useRef<TouchState>({
    touches: new Map(),
    initialPinchDistance: 0,
    initialCameraRatio: 1,
    initialCameraX: 0,
    initialCameraY: 0,
    isPanning: false,
    isPinching: false,
    lastPanX: 0,
    lastPanY: 0,
  });

  useEffect(() => {
    if (!container || !sigmaInstance) return;

    const getTouchDistance = (t1: Touch, t2: Touch): number =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const onTouchStart = (e: TouchEvent) => {
      const state = touchStateRef.current;
      state.touches.clear();

      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        state.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (e.touches.length === 1) {
        state.isPanning = true;
        state.isPinching = false;
        state.lastPanX = e.touches[0].clientX;
        state.lastPanY = e.touches[0].clientY;
      } else if (e.touches.length >= 2) {
        state.isPinching = true;
        state.isPanning = false;
        const camera = sigmaInstance.getCamera();
        state.initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        state.initialCameraRatio = camera.ratio;
        state.initialCameraX = camera.x;
        state.initialCameraY = camera.y;
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;

      if (state.isPinching && e.touches.length >= 2) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = state.initialPinchDistance > 0
          ? currentDistance / state.initialPinchDistance
          : 1;
        const newRatio = Math.max(0.1, Math.min(10, state.initialCameraRatio / scale));

        const camera = sigmaInstance.getCamera();
        camera.setState({
          ratio: newRatio,
          x: state.initialCameraX,
          y: state.initialCameraY,
        });
      } else if (state.isPanning && e.touches.length === 1) {
        const dx = e.touches[0].clientX - state.lastPanX;
        const dy = e.touches[0].clientY - state.lastPanY;
        state.lastPanX = e.touches[0].clientX;
        state.lastPanY = e.touches[0].clientY;

        const camera = sigmaInstance.getCamera();
        camera.setState({
          x: camera.x + dx / camera.ratio,
          y: camera.y + dy / camera.ratio,
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = touchStateRef.current;
      // Remove ended touches
      for (let i = 0; i < e.changedTouches.length; i++) {
        state.touches.delete(e.changedTouches[i].identifier);
      }

      if (e.touches.length === 0) {
        state.isPanning = false;
        state.isPinching = false;
      } else if (e.touches.length === 1 && state.isPinching) {
        // Transition from pinch to pan
        state.isPinching = false;
        state.isPanning = true;
        state.lastPanX = e.touches[0].clientX;
        state.lastPanY = e.touches[0].clientY;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [container, sigmaInstance]);
}
