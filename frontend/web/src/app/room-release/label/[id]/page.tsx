import { redirect } from "next/navigation";

// Ruta anterior: el modulo de Gestion de Residuos ahora vive en /waste-management.
// Se mantiene este redirect para no romper enlaces o marcadores existentes.
export default async function LegacyWasteLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/waste-management/label/${id}`);
}
