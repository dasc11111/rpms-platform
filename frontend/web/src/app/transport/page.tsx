import { sql } from "@/lib/db";
import { ensureTransportTables } from "@/lib/transport";
import { TransportApp } from "@/components/transport/transport-app";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  await ensureTransportTables();

  const { rows: radionuclideRows } = await sql`
    SELECT code, label, activity_label, allows_multiple FROM transport_radionuclides ORDER BY label;
  `;
  const radionuclides = radionuclideRows.map((r: any) => ({
    code: r.code,
    label: r.label,
    activityLabel: r.activity_label,
    allowsMultiple: r.allows_multiple,
  }));

  const { rows: shipmentRows } = await sql`
    SELECT s.*,
      COALESCE(
        (SELECT json_agg(json_build_object('id', a.id, 'label', a.label, 'activityMci', a.activity_mci) ORDER BY a.id)
         FROM transport_i131_activities a WHERE a.shipment_id = s.id),
        '[]'
      ) AS i131_activities
    FROM transport_shipments s
    ORDER BY s.transport_date DESC, s.correlative_number DESC
    LIMIT 500;
  `;

  const { rows: authRows } = await sql`
    SELECT * FROM transport_authorization_documents WHERE is_current = true ORDER BY version DESC LIMIT 1;
  `;

  return (
    <TransportApp
      initialShipments={JSON.parse(JSON.stringify(shipmentRows))}
      radionuclides={radionuclides}
      initialAuthorization={authRows[0] ? JSON.parse(JSON.stringify(authRows[0])) : null}
    />
  );
}
