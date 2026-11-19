import { redirect } from "next/navigation";

export default async function WorkDirectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?work=${id}&step=direction`);
}
