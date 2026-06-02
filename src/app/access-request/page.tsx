import { redirect } from "next/navigation";

export default async function AccessRequestPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next || "/overview";
  redirect(next);
}
