"use client";

import { ReactNode } from "react";

export default function StudentActionCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-5 py-4 ${className ?? ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-end gap-2">{children}</div>
    </td>
  );
}
