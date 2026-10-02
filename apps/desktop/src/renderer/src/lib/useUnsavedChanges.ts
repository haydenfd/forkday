import { useEffect, useRef } from 'react';

export function useUnsavedChanges(
  dirty: boolean,
  allowNavigation?: (destination: string) => boolean,
): (destination: string) => void {
  const bypass = useRef(false);
  useEffect(() => {
    if (!dirty) {
      bypass.current = false;
      return;
    }
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeNavigate = (event: Event): void => {
      if (bypass.current) {
        bypass.current = false;
        return;
      }
      const allowed = allowNavigation
        ? allowNavigation(location.hash)
        : window.confirm('Leave this page without saving your changes?');
      if (!allowed) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('forkday:before-navigate', beforeNavigate);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('forkday:before-navigate', beforeNavigate);
    };
  }, [dirty, allowNavigation]);
  return (destination) => {
    bypass.current = true;
    location.hash = destination;
  };
}
