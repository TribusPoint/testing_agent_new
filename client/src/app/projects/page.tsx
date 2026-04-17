import { redirect } from "next/navigation";

/** Projects list was removed from the app shell; keep URL stable for bookmarks. */
export default function ProjectsIndexPage() {
  redirect("/dashboard");
}
