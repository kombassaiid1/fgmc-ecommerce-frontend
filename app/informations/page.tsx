import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Informations | FGMC",
};

export default function InformationsPage() {
  redirect("/mon-compte/informations");
}
