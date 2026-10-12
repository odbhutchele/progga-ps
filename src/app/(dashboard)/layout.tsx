import { SidebarProvider } from "@/components/SidebarContext";
import SidebarDrawer from "@/components/SidebarDrawer";
import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <div className="h-full flex overflow-hidden">
        <SidebarDrawer>
          <div className="p-4">
            <Link
              href="/"
              className="flex items-center gap-2"
            >
              <Image
                src="/school-logo.jpg"
                alt="logo"
                width={32}
                height={32}
                className="rounded-full flex-shrink-0"
              />
              <span className="font-bold text-sm leading-tight text-white truncate">
                Progga PS
              </span>
            </Link>
            <Menu />
          </div>
        </SidebarDrawer>

        <div className="flex-1 min-w-0 min-h-0 bg-slate-50 overflow-y-auto flex flex-col pb-8 print:overflow-visible print:pb-0">
          <Navbar />
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
