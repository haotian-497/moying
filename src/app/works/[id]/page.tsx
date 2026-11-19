import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getWork } from "@/lib/db";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const numeric = Number(id);
  const work = user && Number.isSafeInteger(numeric) && numeric > 0 ? getWork(user.id, numeric) : null;
  redirect(work?.content ? `/?work=${id}&step=draft` : `/?work=${id}&step=direction`);
}
