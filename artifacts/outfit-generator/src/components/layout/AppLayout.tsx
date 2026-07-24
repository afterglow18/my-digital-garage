import React from "react";
import { Link, useLocation } from "wouter";
import { Shirt, Sparkles, Bookmark, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetWardrobeStats } from "@/hooks/useLocalDB";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: stats } = useGetWardrobeStats();

  const wardrobeCount = stats?.byCategory
    ? stats.byCategory
        .filter((c: { category: string }) =>
          ["outfits", "beauty", "toiletries", "essentials"].includes(c.category)
        )
        .reduce((sum: number, c: { count: number }) => sum + c.count, 0)
    : undefined;

  const navItems = [
    { href: "/",         label: "Garage",   icon: Shirt,    badge: wardrobeCount },
    { href: "/generate", label: "Generate", icon: Sparkles                       },
    { href: "/saved",    label: "Saved",    icon: Bookmark                       },
    { href: "/account",  label: "Settings", icon: Settings                       },
  ];

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">

      {/* ── Sidebar navigation — tablet / iPad only (md+) ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r-[3px] border-black z-50">
        {/* Branding */}
        <div className="px-5 pt-8 pb-5 border-b-[3px] border-black">
          <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 mb-0.5">
            My Digital
          </p>
          <h1 className="font-display font-bold text-3xl uppercase tracking-tighter leading-none">
            Garage
          </h1>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 p-3">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const isActive = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 font-bold text-sm uppercase tracking-wide transition-all",
                  isActive
                    ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black"
                    : "border-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon
                  className="w-5 h-5 shrink-0"
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="flex-1">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <div className="bg-secondary text-black text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    {badge > 99 ? "99+" : badge}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t-[3px] border-black">
          <p className="text-[9px] font-bold uppercase tracking-widest text-black/25 leading-tight">
            My Digital Garage
          </p>
        </div>
      </aside>

      {/* ── Content area + mobile bottom nav ── */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto pb-[90px] md:pb-0 relative">
          {children}
        </main>

        {/* ── Bottom navigation — mobile only ── */}
        <nav className="md:hidden absolute bottom-0 left-0 right-0 bg-white border-t-[3px] border-black p-3 pb-safe z-[40]">
          <ul className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href} className="relative">
                  <Link href={item.href} className="flex flex-col items-center gap-1 group">
                    <div
                      className={cn(
                        "p-2.5 rounded-full border-2 transition-all duration-200 ease-spring relative",
                        isActive
                          ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                          : "bg-transparent border-transparent group-hover:bg-muted group-active:scale-95"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-6 h-6",
                          isActive ? "text-black" : "text-muted-foreground",
                          item.href === "/generate" && isActive ? "animate-pulse" : ""
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {item.badge !== undefined && item.badge > 0 && (
                        <div className="absolute -top-2 -right-2 bg-secondary text-black text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          {item.badge > 99 ? "99+" : item.badge}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider transition-colors",
                        isActive ? "text-black" : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
