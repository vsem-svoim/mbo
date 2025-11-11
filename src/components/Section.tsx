import React from "react";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function Section({ title, children, action, className = "", compact = false }: SectionProps) {
  if (compact) {
    return (
      <div className={`${className}`}>
        <div className="px-3 py-2 text-white text-xs font-semibold flex items-center justify-between border-b border-dark-border/50">
          <div>{title}</div>
          {action && <div>{action}</div>}
        </div>
        <div className="p-3">{children}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-dark-border bg-dark-panel overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-dark-border text-white text-xs font-semibold flex items-center justify-between">
        <div>{title}</div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
