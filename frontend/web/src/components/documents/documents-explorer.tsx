"use client";

import { useCallback, useMemo, useState } from "react";
import { CategoryNav } from "./category-nav";
import { DocumentsPanel } from "./documents-panel";
import type { DocumentCategoryRow } from "@/lib/documents";

export function DocumentsExplorer({ categories: initialCategories }: { categories: DocumentCategoryRow[] }) {
  const [categories, setCategories] = useState<DocumentCategoryRow[]>(initialCategories);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => categories.find((c) => c.id === selectedId) ?? null, [categories, selectedId]);

  const refreshCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/document-categories");
      const data = await res.json();
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
    } catch {
      // se mantienen los conteos previos si falla el refresco
    }
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <div className="rounded-lg border border-border bg-surface p-2 md:max-h-[70vh] md:overflow-y-auto">
        <CategoryNav categories={categories} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <DocumentsPanel
        categoryId={selected?.id ?? null}
        categoryName={selected?.name ?? null}
        onChanged={refreshCategories}
      />
    </div>
  );
}
