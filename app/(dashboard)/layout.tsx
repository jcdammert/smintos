import { BottomNav } from "@/components/modules/BottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Content column constrained to a mobile-first width, centered on larger screens */}
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4">{children}</div>
      <BottomNav />
    </div>
  );
}
