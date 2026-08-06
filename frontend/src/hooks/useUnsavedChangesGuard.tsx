import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';

interface GuardState {
  isDirty: boolean;
  message: string;
}
interface UnsavedChangesContextValue {
  registerGuard: (state: GuardState | null) => void;
  confirmNavigation: () => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);
const DEFAULT_MESSAGE = 'You have unsaved changes. Leave without saving?';

// Lets a builder page register "I have unsaved edits" so any navigation
// attempt elsewhere in the app (sidebar links, a page's own Back link,
// browser tab-close) can prompt for confirmation first. Uses a ref rather
// than state so registering/clearing on every keystroke never triggers a
// re-render of AppShell — only confirmNavigation()/beforeunload ever read it,
// both at click/unload time, not render time.
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<GuardState | null>(null);
  // Tracks whether a duplicate history entry is currently sitting on top of
  // the real one — pushed the moment a page goes dirty so that the *first*
  // Back-button press only pops that duplicate (no visible navigation,
  // browser back-button has no other hook to intercept it) instead of
  // actually leaving; a confirmed Back then consumes the real entry too.
  const duplicateEntryRef = useRef(false);

  const registerGuard = useCallback((state: GuardState | null) => {
    const wasDirty = !!guardRef.current?.isDirty;
    guardRef.current = state;
    const isDirty = !!state?.isDirty;
    if (isDirty && !wasDirty && !duplicateEntryRef.current) {
      window.history.pushState(null, '', window.location.href);
      duplicateEntryRef.current = true;
    }
  }, []);
  const confirmNavigation = useCallback(() => {
    const guard = guardRef.current;
    if (!guard?.isDirty) return true;
    return window.confirm(guard.message || DEFAULT_MESSAGE);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (guardRef.current?.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    function handlePopState() {
      duplicateEntryRef.current = false;
      if (!guardRef.current?.isDirty) return;
      if (confirmNavigation()) {
        // Clear immediately so the second, programmatic back() below (which
        // consumes the real previous entry) doesn't re-trigger this prompt.
        guardRef.current = null;
        window.history.back();
      } else {
        window.history.pushState(null, '', window.location.href);
        duplicateEntryRef.current = true;
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [confirmNavigation]);

  return (
    <UnsavedChangesContext.Provider value={{ registerGuard, confirmNavigation }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesGuard() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error('useUnsavedChangesGuard must be used within an UnsavedChangesProvider');
  return ctx;
}

// Convenience for a builder page: registers/clears its own dirty state as it changes.
export function useRegisterUnsavedGuard(isDirty: boolean, message?: string) {
  const { registerGuard } = useUnsavedChangesGuard();
  useEffect(() => {
    registerGuard(isDirty ? { isDirty: true, message: message ?? DEFAULT_MESSAGE } : null);
    return () => registerGuard(null);
  }, [isDirty, message, registerGuard]);
}
