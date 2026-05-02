"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  MapPin,
  Sprout,
  Upload,
  LogOut,
  Leaf,
  CalendarDays,
} from "lucide-react";

interface SidebarProps {
  userEmail: string;
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/talhoes", label: "Talhões", icon: MapPin },
  { href: "/dashboard/plantios", label: "Plantios", icon: Sprout },
  {
    href: "/dashboard/janela-plantio",
    label: "Janela de Plantio",
    icon: CalendarDays,
  },
  { href: "/dashboard/uploads", label: "Uploads", icon: Upload },
];

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="w-64 bg-gray-900 flex flex-col h-full shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Agrodash</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-green-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 truncate mb-3">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
