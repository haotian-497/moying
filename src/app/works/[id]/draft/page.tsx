import { redirect } from "next/navigation";

export default async function WorkDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?work=${id}&step=draft`);
}
