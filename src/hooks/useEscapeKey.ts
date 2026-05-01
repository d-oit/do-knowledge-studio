import { useEffect } from 'react';

export const useEscapeKey = (onClose: () => void, active: boolean) => {
  useEffect(() => {
    if (!active) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, active]);

  return null;
};
