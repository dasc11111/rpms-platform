"use client";
import * as React from "react";
import { clsx } from "clsx";

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
            active === item.key
              ? "border-b-2 border-accent text-accent"
              : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
