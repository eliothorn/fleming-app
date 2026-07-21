import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/session";
import AppClient from "./AppClient";

export default async function AppPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return <AppClient />;
}
