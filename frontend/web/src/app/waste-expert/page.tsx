"use client";


import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  WasteExpertDashboard,
  type WasteItemRow,
  type RadionuclideOption,
} from "@/components/waste-expert/waste-expert-dashboard";

export default function WasteExpertPage() {
  const [items, setItems] = useState<WasteItemRow[]>([]);
  const [radionuclides, setRadionuclides] = useState<RadionuclideOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [itemsRes, rnRes] = await Promise.all([
          fetch("/api/waste-items"),
          fetch("/api/radionuclides?active=true"),
        ]);
        const itemsData = await itemsRes.json();
        const rnData = await rnRes.json();
        setItems(itemsData.items ?? []);
        setRadionuclides(rnData.rows ?? []);
      } catch {
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (error)
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );

  return <WasteExpertDashboard items={items} radionuclides={radionuclides} />;
}
