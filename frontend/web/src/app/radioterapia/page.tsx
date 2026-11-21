import { ensureRadioterapiaTables } from "@/lib/radioterapia";
import { RadioterapiaApp } from "@/components/radioterapia/radioterapia-app";

export const dynamic = "force-dynamic";

export default async function RadioterapiaPage() {
  await ensureRadioterapiaTables();
  return <RadioterapiaApp />;
}
