import { redirect } from "next/navigation";

// Root: redirect to the dashboard home
export default function RootPage() {
  redirect("/dashboard");
}
