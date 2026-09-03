"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Biohazard, CheckCircle2, ShieldAlert, Ban, FlaskConical } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/Badge";
import { SmartTable, type SmartTableColumn } from "@/components/ui/Table";
import { WasteExpertNewItemModal } from "@/components/waste-expert/waste-expert-new-item-modal";
import { WASTE_ITEM_ESTADO_META, tipoResiduoLabel, fmtDateTime, fmtNumber } from "@/lib/waste-expert-ui";

export type WasteItemRow = {
  id: number;
  item_code: string;
  radionuclide_code: string;
  radionuclide_name?: string | null;
  radionuclide_symbol?: string | null;
  tipo_residuo: string;
  estado: string;
  fecha_hora_generacion: string | null;
  actividad_inicial: number | null;
  unidad_actividad: string | null;
  ubicacion: string | null;
  responsable: string | null;
};

export type RadionuclideOption = {
  code: string;
  name: string;
  symbol: string | null;
  half_life_days: number | null;
};

export function WasteExpertDashboard({
  items,
  radionuclides,
}: {
  items: WasteItemRow[];
  radionuclides: RadionuclideOption[];
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.estado] = (c[it.estado] ?? 0) + 1;
    return c;
  }, [items]);

  const enProceso =
    (counts["registrado"] ?? 0) +
    (counts["en_decaimiento"] ?? 0) +
    (counts["pendiente_medicion"] ?? 0) +
    (counts["pendiente_verificacion"] ?? 0);

  const columns: SmartTableColumn<WasteItemRow>[] = [
    {
      key: "item_code",
      header: "Código",
      accessor: (row) => (
        <Link href={`/waste-expert/${row.id}`} className="font-mono text-xs font-medium text-accent hover:underline">
          {row.item_code}
        </Link>
      ),
      sortValue: (row) => row.item_code,
    },
    {
      key: "radionuclido",
      header: "Radionúclido",
      accessor: (row) => row.radionuclide_symbol || row.radionuclide_code,
      sortValue: (row) => row.radionuclide_code,
    },
    {
      key: "tipo_residuo",
      header: "Tipo de residuo",
      accessor: (row) => tipoResiduoLabel(row.tipo_residuo),
      sortValue: (row) => row.tipo_residuo,
    },
    {
      key: "estado",
      header: "Estado",
      accessor: (row) => {
        const meta = WASTE_ITEM_ESTADO_META[row.estado as keyof typeof WASTE_ITEM_ESTADO_META];
        return <StatusBadge status={meta ? meta.label : row.estado} level={meta?.level} />;
      },
      sortValue: (row) => row.estado,
    },
    {
      key: "fecha_generacion",
      header: "Fecha de generación",
      accessor: (row) => fmtDateTime(row.fecha_hora_generacion),
      sortValue: (row) => row.fecha_hora_generacion ?? "",
    },
    {
      key: "actividad_inicial",
      header: "Actividad inicial",
      accessor: (row) => (row.actividad_inicial != null ? `${fmtNumber(row.actividad_inicial)} ${row.unidad_actividad ?? ""}` : "—"),
      sortValue: (row) => row.actividad_inicial ?? 0,
    },
    {
      key: "ubicacion",
      header: "Ubicación",
      accessor: (row) => row.ubicacion ?? "—",
      sortValue: (row) => row.ubicacion ?? "",
    },
    {
      key: "responsable",
      header: "Responsable",
      accessor: (row) => row.responsable ?? "—",
      sortValue: (row) => row.responsable ?? "",
    },
  ];

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Sistema Experto de Gestión de Desechos Radiactivos</h1>
          <p className="text-sm text-muted-foreground">
            Registro y evaluación individual de residuos radiactivos de Medicina Nuclear. Cada residuo es una entidad
            independiente con su propia historia de mediciones, decisiones y autorizaciones.
          </p>
        </div>
        <WasteExpertNewItemModal radionuclides={radionuclides} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total de fichas" value={items.length} icon={<FlaskConical className="h-5 w-5" />} />
        <KpiCard label="En proceso" value={enProceso} icon={<Biohazard className="h-5 w-5" />} level="warning" />
        <KpiCard label="Pendiente verificación" value={counts["pendiente_verificacion"] ?? 0} icon={<ShieldAlert className="h-5 w-5" />} level="warning" />
        <KpiCard label="Disponible evaluación final" value={counts["disponible_evaluacion_final"] ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} level="ok" />
        <KpiCard label="Liberados" value={counts["liberado"] ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} level="ok" />
        <KpiCard label="Bloqueados / No cumple" value={(counts["bloqueado"] ?? 0) + (counts["no_cumple"] ?? 0)} icon={<Ban className="h-5 w-5" />} level="critical" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fichas de residuos</CardTitle>
        </CardHeader>
        <CardContent>
          <SmartTable
            columns={columns}
            data={items}
            rowKey={(row) => row.id}
            storageKey="waste-expert-items"
            exportFileName="residuos-radiactivos"
            emptyMessage="No hay residuos registrados todavía."
          />
        </CardContent>
      </Card>
    </div>
  );
}
