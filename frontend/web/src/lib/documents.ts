export const MEDICINA_NUCLEAR_SUBCATEGORIES: string[] = [
    "Autorización de Funcionamiento",
    "Autorización de Operación",
    "Autorizaciones de Desempeño",
    "Licencias de Operadores",
    "Programa de Protección Radiológica",
    "Manual de Organización",
    "Manual de Calidad",
    "Procedimientos Operacionales",
    "Procedimientos Administrativos",
    "Procedimientos de Emergencia",
    "Procedimientos de Derrames",
    "Gestión de Residuos Radiactivos",
    "Gestión de Generadores Mo-99/Tc-99m",
    "Recepción de Material Radiactivo",
    "Transporte de Material Radiactivo",
    "Inventario de Material Radiactivo",
    "Inventario de Fuentes",
    "Inventario de Equipamiento",
    "Activímetro",
    "Cámara Gamma",
    "SPECT",
    "PET/CT",
    "Detectores de Contaminación",
    "Detectores Portátiles",
    "Certificados de Calibración",
    "Controles de Calidad",
    "Levantamientos Radiométricos",
    "Monitoreo de Áreas",
    "Monitoreo Ambiental",
    "Monitoreo de Contaminación",
    "Dosimetría Personal",
    "Dosimetría de Área",
    "Vigilancia Médica",
    "Capacitación",
    "Auditorías Internas",
    "Auditorías Externas",
    "Inspecciones SEREMI",
    "Inspecciones CCHEN",
    "Inspecciones ISP",
    "Actas",
    "Informes Técnicos",
    "Informes Dosimétricos",
    "Informes de Incidentes",
    "Reporte de Derrames",
    "Reporte de Sobreexposición",
    "Gestión de No Conformidades",
    "Planes de Mejora",
    "Correspondencia Oficial",
    "Convenios",
    "Contratos",
    "Licitaciones",
    "Normativa Nacional",
    "Normativa Internacional",
    "IAEA",
    "ICRP",
    "UNSCEAR",
    "Documentación Histórica",
  ];

export function slugify(input: string): string {
    return input
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
}

export function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exp);
    return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}

export type DocumentSortField = "name" | "created_at" | "updated_at" | "size";
export type SortDir = "asc" | "desc";

export type DocumentCategoryRow = {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    sort_order: number;
    document_count?: number;
};

export type DocumentCategoryNode = DocumentCategoryRow & {
    children: DocumentCategoryNode[];
};

export function buildCategoryTree(rows: DocumentCategoryRow[]): DocumentCategoryNode[] {
    const byId = new Map<number, DocumentCategoryNode>();
    rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
    const roots: DocumentCategoryNode[] = [];
    byId.forEach((node) => {
          if (node.parent_id && byId.has(node.parent_id)) {
                  byId.get(node.parent_id)!.children.push(node);
          } else {
                  roots.push(node);
          }
    });
    const sortFn = (a: DocumentCategoryNode, b: DocumentCategoryNode) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name);
    const sortRec = (nodes: DocumentCategoryNode[]) => {
          nodes.sort(sortFn);
          nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
}
