"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, homeFor } from "@/lib/auth";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await authenticate(email, password);
  if (!user) return { error: "Incorrect email or password." };

  await createSession(user);
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
