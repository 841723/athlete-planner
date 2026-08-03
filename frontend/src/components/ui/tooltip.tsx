import { cn } from "@/lib/utils";
import { createContext, useContext, useState, type ReactNode } from "react";

interface TooltipContextValue {
  tooltip: { content: string; x: number; y: number } | null;
  showTooltip: (content: string, x: number, y: number) => void;
  hideTooltip: () => void;
}

const TooltipContext = createContext<TooltipContextValue>({
  tooltip: null,
  showTooltip: () => {},
  hideTooltip: () => {},
});

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tooltip, setTooltip] = useState<TooltipContextValue["tooltip"]>(null);

  return (
    <TooltipContext.Provider
      value={{
        tooltip,
        showTooltip: (content, x, y) => setTooltip({ content, x, y }),
        hideTooltip: () => setTooltip(null),
      }}
    >
      {children}
      {tooltip && (
        <div
          className="tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 20 }}
        >
          {tooltip.content}
        </div>
      )}
    </TooltipContext.Provider>
  );
}

export function useTooltip() {
  return useContext(TooltipContext);
}