import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  status?: {
    label: string;
    active?: boolean;
  };
}

interface PageLayoutProps {
  header: PageHeaderProps;
  children: React.ReactNode;
  layout?: "single" | "two-col" | "three-col";
}

export function PageLayout({ header, children, layout = "three-col" }: PageLayoutProps) {
  const layoutClasses = {
    single: "grid-cols-1",
    "two-col": "grid-cols-1 xl:grid-cols-[280px_1fr]",
    "three-col": "grid-cols-1 xl:grid-cols-[320px_1fr_360px]",
  };

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-200 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 bg-dark-panel border-b border-dark-border">
        <div className="flex items-center gap-6">
          <div className="text-white font-extrabold text-lg">{header.title}</div>
          {header.subtitle && (
            <div className="text-xs text-slate-400">{header.subtitle}</div>
          )}
        </div>
        {header.status && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                header.status.active ? "bg-slate-400" : "bg-slate-500"
              }`}
            />
            <span>{header.status.label}</span>
          </div>
        )}
      </div>

      <div className={`grid ${layoutClasses[layout]} gap-4 bg-dark-bg flex-1 min-h-0 p-4`}>
        {children}
      </div>
    </div>
  );
}
