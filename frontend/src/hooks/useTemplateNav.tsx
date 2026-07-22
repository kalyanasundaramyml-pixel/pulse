import { createContext, ReactNode, useContext, useState } from 'react';

interface TemplateNavContextValue {
  isTemplateActive: boolean;
  setIsTemplateActive: (active: boolean) => void;
}

const TemplateNavContext = createContext<TemplateNavContextValue | null>(null);

// Lets a builder page declare "I'm currently showing a template" so the top nav
// keeps "Templates" highlighted instead of "Surveys"/"One-on-Ones", regardless of
// which route you used to get to the template's edit page.
export function TemplateNavProvider({ children }: { children: ReactNode }) {
  const [isTemplateActive, setIsTemplateActive] = useState(false);
  return (
    <TemplateNavContext.Provider value={{ isTemplateActive, setIsTemplateActive }}>
      {children}
    </TemplateNavContext.Provider>
  );
}

export function useTemplateNav() {
  const ctx = useContext(TemplateNavContext);
  if (!ctx) throw new Error('useTemplateNav must be used within a TemplateNavProvider');
  return ctx;
}
