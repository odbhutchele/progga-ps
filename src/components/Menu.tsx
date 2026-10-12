import { currentUser } from "@/lib/auth-server";
import NavLink from "@/components/NavLink";

const menuItems: {
  title: string;
  items: {
    icon: string;
    label: string;
    href: string;
    visible: string[];
  }[];
}[] = [
  {
    title: "MENU",
    items: [
      { icon: "Home", label: "Home", href: "/", visible: ["admin", "teacher", "student"] },
      { icon: "GraduationCap", label: "Teachers", href: "/list/teachers", visible: ["admin", "teacher"] },
      { icon: "Users", label: "Students", href: "/list/students", visible: ["admin", "teacher"] },
      { icon: "School", label: "Classes", href: "/list/classes", visible: ["admin", "teacher"] },
      { icon: "CalendarDays", label: "Class Routine", href: "/routine", visible: ["admin", "teacher", "student"] },
    ],
  },
  {
    title: "ACADEMICS",
    items: [
      { icon: "ClipboardList", label: "Exams", href: "/list/exams", visible: ["admin", "teacher", "student"] },
      { icon: "CalendarClock", label: "Exam Schedule", href: "/exams/schedule", visible: ["admin", "teacher", "student"] },
      { icon: "IdCard", label: "Admit Cards", href: "/exams/admit-cards", visible: ["admin", "student"] },
      { icon: "FilePen", label: "Marksheet Entry", href: "/exams/marksheet", visible: ["admin", "teacher"] },
      { icon: "BarChart3", label: "Report Cards", href: "/report-cards", visible: ["admin", "teacher", "student"] },
      { icon: "Trophy", label: "Exam Results", href: "/list/results", visible: ["admin", "teacher", "student"] },
      { icon: "UserCheck", label: "Attendance", href: "/list/attendance", visible: ["admin", "teacher", "student"] },
    ],
  },
  {
    title: "ACCOUNTING",
    items: [
      { icon: "Package", label: "Fee Packages", href: "/fees/packages", visible: ["admin"] },
      { icon: "Banknote", label: "Collect Fees", href: "/fees/collect", visible: ["admin"] },
      { icon: "ClipboardList", label: "Admission Fees", href: "/fees/admission-fees", visible: ["admin"] },
      { icon: "BookOpen", label: "Ledger", href: "/fees/ledger", visible: ["admin", "student", "teacher"] },
      { icon: "ReceiptText", label: "Expenses", href: "/fees/expenses", visible: ["admin"] },
      { icon: "Boxes", label: "Inventory", href: "/inventory", visible: ["admin"] },
      { icon: "PieChart", label: "Finance Reports", href: "/fees/reports", visible: ["admin"] },
      { icon: "Receipt", label: "Salary Billing", href: "/salaries/billing", visible: ["admin"] },
      { icon: "Wallet", label: "Payroll Portal", href: "/salaries/payroll", visible: ["admin"] },
    ],
  },
  {
    title: "MESSAGING",
    items: [
      { icon: "MessageSquare", label: "Notice & SMS Board", href: "/notices", visible: ["admin", "teacher", "student"] },
      { icon: "Megaphone", label: "Announcements", href: "/list/announcements", visible: ["admin", "teacher", "student"] },
      { icon: "Calendar", label: "Events Calendar", href: "/list/events", visible: ["admin", "teacher", "student"] },
    ],
  },
  {
    title: "OTHER",
    items: [
      { icon: "UserCircle", label: "Profile", href: "/profile", visible: ["admin", "teacher", "student"] },
      { icon: "Settings", label: "Settings", href: "/settings", visible: ["admin", "teacher", "student"] },
      { icon: "LogOut", label: "Logout", href: "/logout", visible: ["admin", "teacher", "student"] },
    ],
  },
];

const Menu = async () => {
  const user = await currentUser();
  const role = user?.publicMetadata.role as string;

  return (
    <div className="mt-6 text-sm">
      {menuItems.map((section) => (
        <div className="flex flex-col gap-0.5 mb-4" key={section.title}>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-1">
            {section.title}
          </span>
          {section.items.map((item) => {
            if (!item.visible.includes(role)) return null;
            return (
              <NavLink key={item.label} href={item.href} label={item.label} icon={item.icon} />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default Menu;
