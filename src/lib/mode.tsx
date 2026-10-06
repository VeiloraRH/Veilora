import { createContext, useContext, useState, type ReactNode } from "react";

// Standard mode for everyday users; Control mode adds route, proof, note and policy detail.
export type Mode = "standard" | "control";

const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: "standard",
  setMode: () => {},
});

function readMode(): Mode {
  try {
    return localStorage.getItem("veilora:mode") === "control" ? "control" : "standard";
  } catch {
    return "standard";
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem("veilora:mode", m);
    } catch {
      // Storage unavailable: the choice lasts for this session only.
    }
  };
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
