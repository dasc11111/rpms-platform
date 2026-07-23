import WasteLabelView from "@/components/room-release/waste-label-view";

export default async function WasteLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WasteLabelView labelId={id} />;
}
