import { createContext, useContext, useState } from "react";

const PresentationContext = createContext({ on: false, setOn: () => {} });

export function PresentationProvider({ children }) {
  const [on, setOn] = useState(false);
  return (
    <PresentationContext.Provider value={{ on, setOn }}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentationMode() {
  return useContext(PresentationContext);
}
