"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, GraduationCap, Users, School, CalendarDays,
  ClipboardList, CalendarClock, IdCard, FilePen, BarChart3,
  Trophy, UserCheck, Package, Banknote, BookOpen, PieChart,
  Receipt, Wallet, MessageSquare, Megaphone, Calendar,
  UserCircle, Settings, LogOut, Boxes, ReceiptText,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Home, GraduationCap, Users, School, CalendarDays,
  ClipboardList, CalendarClock, IdCard, FilePen, BarChart3,
  Trophy, UserCheck, Package, Banknote, BookOpen, PieChart,
  Receipt, Wallet, MessageSquare, Megaphone, Calendar,
  UserCircle, Settings, LogOut, Boxes, ReceiptText,
};

export default function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");

  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-colors duration-150 ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {Icon && <Icon size={17} className="flex-shrink-0" />}
      <span>{label}</span>
    </Link>
  );
}
