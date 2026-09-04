import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface AssistantWorkContext {
  customerId?: string;
  cropId?: string;
  customerName?: string;
}

interface AssistantContextValue {
  /** Optional working context (e.g. the agent's active call: farmer + crop). */
  context: AssistantWorkContext | null;
  setContext: (context: AssistantWorkContext | null) => void;
}

const AssistantContext = createContext<AssistantContextValue>({
  context: null,
  setContext: () => undefined,
});

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [context, setContextState] = useState<AssistantWorkContext | null>(null);
  const setContext = useCallback((next: AssistantWorkContext | null) => setContextState(next), []);
  const value = useMemo(() => ({ context, setContext }), [context, setContext]);
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

/** Lets any screen (e.g. the Agent workspace) pre-fill the assistant's context. */
export function useAssistantContext(): AssistantContextValue {
  return useContext(AssistantContext);
}
