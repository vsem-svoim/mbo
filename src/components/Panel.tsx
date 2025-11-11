import React from "react";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className = "" }: PanelProps) {
  return (
    <div className={`bg-dark-bg overflow-y-auto p-3 ${className}`}>
      {children}
    </div>
  );
}
