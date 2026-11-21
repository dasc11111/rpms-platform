import { ensureLinacTables } from "@/lib/linac";
import { LinacApp } from "@/components/linac/linac-app";

export const dynamic = "force-dynamic";

export default async function LinacPage() {
  await ensureLinacTables();
  return <LinacApp />;
}
