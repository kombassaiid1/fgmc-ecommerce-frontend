import { redirect } from "next/navigation";

// Zones moved to International > Zones géographiques. Old links keep working.
export default function OldZonesPage() {
  redirect("/admin_ben/international/zones");
}
