import { redirect } from "next/navigation";

export default async function WorkTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?work=${id}&step=topic`);
}
