import React from "react";
import clsx from "clsx";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "blue" | "danger" | "dark" | "success" | "warning";
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Button({
  children,
  onClick,
  variant = "dark",
  icon,
  className = "",
  disabled = false,
  size = "md",
}: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-2 py-1 text-[11px]",
    md: "px-3 py-2 text-[12px]",
    lg: "px-4 py-3 text-[14px]",
  };

  const variantClasses = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-white",
    blue: "bg-blue-500 hover:bg-blue-600 text-white",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    dark: "bg-dark-border hover:bg-dark-hover text-zinc-200",
    success: "bg-green-500 hover:bg-green-600 text-white",
    warning: "bg-amber-500 hover:bg-amber-600 text-white",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
