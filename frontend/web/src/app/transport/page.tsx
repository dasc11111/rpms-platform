"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { TransportApp } from "@/components/transport/transport-app";
import { Loader2 } from "lucide-react";

export default function TransportPage() {
  const [data, setData] = useState<{
    shipments: unknown[];
    radionuclides: unknown[];
    authorization: unknown | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [shipRes, nucRes, authRes] = await Promise.all([
          fetch("/api/transport"),
          fetch("/api/transport/radionuclides"),
          fetch("/api/transport/authorization"),
        ]);
        const [shipData, nucData, authData] = await Promise.all([
          shipRes.json(),
          nucRes.json(),
          authRes.json(),
        ]);
        setData({
          shipments:    shipData.shipments    ?? [],
          radionuclides: nucData.radionuclides ?? [],
          authorization: authData.authorization ?? null,
        });
      } catch (e) {
        setError(String(e));
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-red-600">
        Error cargando datos de transporte: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando transporte…
      </div>
    );
  }

  return (
    <TransportApp
      initialShipments={data.shipments}
      radionuclides={data.radionuclides as Parameters<typeof TransportApp>[0]["radionuclides"]}
      initialAuthorization={data.authorization}
    />
  );
}
