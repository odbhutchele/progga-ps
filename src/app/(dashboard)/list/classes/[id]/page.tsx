import { redirect } from "next/navigation";

export default function ClassIdPage({ params }: { params: { id: string } }) {
  redirect(`/list/classes/${params.id}/students`);
}
