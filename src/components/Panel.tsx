import React from "react";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  spacing?: "none" | "compact" | "normal";
}

export function Panel({ children, className = "", spacing = "normal" }: PanelProps) {
  const spacingClasses = {
    none: "",
    compact: "gap-3",
    normal: "gap-4"
  };

  return (
    <div className={`bg-dark-bg overflow-y-auto p-3 flex flex-col ${spacingClasses[spacing]} ${className}`}>
      {children}
    </div>
  );
}
