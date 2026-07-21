"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { buildCategoryTree } from "@/lib/documents";
import type { DocumentCategoryNode, DocumentCategoryRow } from "@/lib/documents";

export function CategoryNav({
  categories,
  selectedId,
  onSelect,
}: {
  categories: DocumentCategoryRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selectedId == null) return;
    const row = categories.find((c) => c.id === selectedId);
    if (row?.parent_id) {
      setExpanded((prev) => new Set(prev).add(row.parent_id as number));
    }
  }, [selectedId, categories]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function renderNode(node: DocumentCategoryNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedId === node.id;
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              toggle(node.id);
            } else {
              onSelect(node.id);
            }
          }}
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
            isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {hasChildren ? (
            isExpanded ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
          {typeof node.document_count === "number" && node.document_count > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">
              {node.document_count}
            </span>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  return <div className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</div>;
}
