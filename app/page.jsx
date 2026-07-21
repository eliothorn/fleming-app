import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/session";

export default async function Root() {
  const user = await getServerUser();
  redirect(user ? "/app" : "/login");
}
