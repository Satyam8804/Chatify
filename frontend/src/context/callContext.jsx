import { createContext, useContext, useState, useCallback } from "react";

/**
 * CallContext — owns only the minimize/maximize concern.
 * Call logic (WebRTC, sockets, streams) stays in ChatLayout / VideoCall.
 * Wrapping at app root means isMinimized survives route changes.
 */
const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const minimizeCall = useCallback(() => setIsMinimized(true), []);
  const maximizeCall = useCallback(() => setIsMinimized(false), []);
  const resetMinimize = useCallback(() => setIsMinimized(false), []);

  return (
    <CallContext.Provider
      value={{ isMinimized, minimizeCall, maximizeCall, resetMinimize }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCallContext = () => {
  const ctx = useContext(CallContext);
  if (!ctx)
    throw new Error("useCallContext must be used inside <CallProvider>");
  return ctx;
};
