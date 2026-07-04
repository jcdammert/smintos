import { redirect } from "next/navigation";

export default function EstimatesPage() {
  redirect("/library?tab=estimates");
}
