import { redirect } from "next/navigation";

export default function InvoicesPage() {
  redirect("/library?tab=invoices");
}
