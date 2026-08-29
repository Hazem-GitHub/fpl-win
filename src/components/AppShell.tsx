"use client";

import { BrandLockup } from "@/components/Brand";
import { Icon, IconLabel } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppStateProvider } from "@/components/AppState";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Shirt,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Briefing", icon: ClipboardList },
  { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { href: "/players", label: "Rankings", icon: BarChart3 },
  { href: "/builder", label: "Builder", icon: Wrench },
  { href: "/team", label: "My team", icon: Shirt },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  deadline,
}: {
  children: React.ReactNode;
  deadline?: string;
}) {
  const pathname = usePathname();

  return (
    <AppStateProvider>
    <div className="flex min-h-full min-w-0 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:h-16 sm:gap-6 sm:px-4">
          <Link href="/" className="flex shrink-0" aria-label="Pitch home">
            <BrandLockup />
          </Link>
          <nav className="hidden min-w-0 items-center gap-0.5 text-sm md:flex">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-2 py-1.5 lg:px-3 ${
                    active
                      ? "bg-panel-2 font-medium text-foreground"
                      : "text-muted hover:bg-panel-2 hover:text-foreground"
                  }`}
                >
                  <IconLabel icon={link.icon} size="sm">
                    {link.label}
                  </IconLabel>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {deadline ? (
              <p className="hidden min-w-0 truncate text-xs text-muted lg:block">
                Next deadline{" "}
                <span className="tabular text-foreground">{deadline}</span>
              </p>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>

      <footer className="hidden border-t border-line px-4 py-4 text-center text-xs text-muted md:block">
        Public FPL data. Maximizes expected points — it cannot guarantee a
        win. Transfers stay on fantasy.premierleague.com.
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-5">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon icon={link.icon} size="lg" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    </AppStateProvider>
  );
}
