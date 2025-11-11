import React from "react";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Section({ title, children, action, className = "" }: SectionProps) {
  return (
    <div className={`m-3 rounded-lg border border-dark-border bg-dark-panel overflow-hidden ${className}`}>
      <div className="px-4 py-2 border-b border-dark-border text-white text-[13px] font-semibold flex items-center justify-between">
        <div>{title}</div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
