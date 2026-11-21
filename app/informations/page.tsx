import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Informations",
  robots: { index: false, follow: false },
};

export default function InformationsPage() {
  redirect("/mon-compte/informations");
}
