import { FileText, FolderTree, FolderOpen } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DocumentsExplorer } from "@/components/documents/documents-explorer";
import { sql } from "@/lib/db";
import type { DocumentCategoryRow } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { rows } = await sql`
    SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order,
           COUNT(d.id)::int AS document_count
    FROM document_categories c
    LEFT JOIN documents d ON d.category_id = c.id
    GROUP BY c.id, c.name, c.slug, c.parent_id, c.sort_order
    ORDER BY c.sort_order, c.name
  `;
  const categories = rows as unknown as DocumentCategoryRow[];
  const totalDocuments = categories.reduce((sum, c) => sum + (c.document_count ?? 0), 0);
  const topLevel = categories.filter((c) => c.parent_id === null).length;
  const subcategories = categories.filter((c) => c.parent_id !== null).length;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Documentos</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Documentos cargados" value={totalDocuments} href="/documents" icon={FileText} />
        <KPICard label="Categorías principales" value={topLevel} href="/documents" icon={FolderTree} />
        <KPICard label="Subcategorías / carpetas" value={subcategories} href="/documents" icon={FolderOpen} />
      </div>
      <DocumentsExplorer categories={categories} />
    </div>
  );
}
