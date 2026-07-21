import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";

export async function GET(request) {
  const user = await getServerUser(request);
  return NextResponse.json({ user });
}
