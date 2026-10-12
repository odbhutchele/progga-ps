"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "./SidebarContext";

export default function SidebarDrawer({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useSidebar();
  const pathname = usePathname();

  // Close on navigation
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  // Close when viewport grows past md
  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 768) setOpen(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [setOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden print:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar panel */}
      <aside
        className={`
          group/sidebar print:hidden
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 overflow-y-auto transition-transform duration-300
          md:static md:translate-x-0 md:w-60 xl:w-64 md:h-full md:min-h-0
          ${open ? "translate-x-0 mobile-open" : "-translate-x-full"}
        `}
      >
        {children}
      </aside>
    </>
  );
}
