"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  PlateIcon,
  Dumbbell01Icon,
  CheckListIcon,
  Analytics01Icon,
  AiChat01Icon,
  Book02Icon,
  Target01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { MoreHorizontalIcon, Cancel01Icon, Logout01Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NavItem = {
  icon: typeof PlateIcon;
  label: string;
  href: string;
  comingSoon: boolean;
  primary?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { icon: DashboardSquare01Icon, label: "Home", href: "/dashboard", comingSoon: false, primary: true },
  { icon: PlateIcon, label: "Plate", href: "/dashboard/plate", comingSoon: false, primary: true },
  { icon: CheckListIcon, label: "Log", href: "/dashboard/log", comingSoon: false, primary: true },
  { icon: Analytics01Icon, label: "Progress", href: "/dashboard/progress", comingSoon: false, primary: true },
  { icon: PlateIcon, label: "Menu", href: "/menu", comingSoon: false },
  { icon: Dumbbell01Icon, label: "Workout", href: "/dashboard/workout", comingSoon: false },
  { icon: AiChat01Icon, label: "Coach", href: "/dashboard/chat", comingSoon: false },
  { icon: Book02Icon, label: "Learn", href: "/learn", comingSoon: false },
  { icon: Target01Icon, label: "Goals", href: "/dashboard/goals", comingSoon: true },
  { icon: Settings01Icon, label: "Settings", href: "/dashboard/settings", comingSoon: false },
];

const PRIMARY = NAV_ITEMS.filter((i) => i.primary);
const SECONDARY = NAV_ITEMS.filter((i) => !i.primary);

function Logo() {
  return (
    <Link href="/" className="text-xl font-black tracking-tighter">
      <span className="text-white">MESS</span>
      <span className="text-accent">FIT</span>
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? null);
        setDisplayName((data.user.user_metadata?.display_name as string) ?? null);
        setAvatarUrl((data.user.user_metadata?.avatar_url as string) ?? null);
      }
    });
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const displayLabel = displayName ?? email ?? "User";
  const initial = displayLabel.charAt(0).toUpperCase();
  const isActive = (href: string) => pathname === href;
  const onSecondaryRoute = SECONDARY.some((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
      >
        Skip to content
      </a>

      {/* ── Desktop sidebar (≥lg) ── */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-6">
          <Logo />
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6">
          {NAV_ITEMS.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar initial={initial} imageUrl={avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white">{displayLabel}</p>
              {email && <p className="truncate text-[11px] font-medium text-muted-foreground">{email}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-bold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
          >
            <HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (<lg) ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-background/80 px-5 backdrop-blur-xl lg:hidden border-b border-border/50">
        <Logo />
        <Avatar initial={initial} imageUrl={avatarUrl} />
      </header>

      {/* ── Main ── */}
      <main id="main-content" className="flex min-h-screen flex-1 flex-col pb-20 pt-14 lg:ml-64 lg:pb-0 lg:pt-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col w-full h-full"
        >
          {children}
        </motion.div>
      </main>

      {/* ── Mobile bottom tab bar (<lg) ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY.map((item) => (
          <TabButton
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={isActive(item.href)}
          />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold tracking-wide transition-colors",
            moreOpen || onSecondaryRoute ? "text-accent" : "text-muted-foreground hover:text-white",
          )}
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <HugeiconsIcon icon={MoreHorizontalIcon} size={22} strokeWidth={2} color="currentColor" />
          </div>
          More
        </button>
      </nav>

      {/* ── Mobile "More" sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-surface p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-black tracking-tight text-white">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="rounded-full bg-surface-2 p-2 text-muted-foreground transition-colors hover:text-white"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SECONDARY.map((item) => (
                <NavRow key={item.label} item={item} active={isActive(item.href)} compact />
              ))}
            </div>
            <button
              onClick={handleLogout}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-3.5 text-sm font-bold text-white transition-colors hover:bg-border"
            >
              <HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
              Sign out
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Avatar({ initial, imageUrl }: { initial: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Avatar"
        className="h-8 w-8 shrink-0 rounded-full object-cover border border-border"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-black text-white border border-border">
      {initial}
    </div>
  );
}

function NavRow({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const base = cn(
    "flex items-center gap-3 rounded-xl px-4 font-bold transition-all",
    compact ? "py-3 text-sm bg-surface-2" : "py-3.5 text-[14px]",
    active
      ? "bg-accent text-black"
      : item.comingSoon
        ? "cursor-not-allowed opacity-40 text-muted-foreground"
        : compact ? "text-muted-foreground hover:text-white" : "text-muted-foreground hover:bg-surface-2 hover:text-white",
  );
  
  const inner = (
    <>
      <div className="flex h-6 w-6 items-center justify-center">
        <HugeiconsIcon icon={item.icon} size={20} strokeWidth={2} color="currentColor" />
      </div>
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon && (
        <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          Soon
        </span>
      )}
    </>
  );
  
  if (item.comingSoon) {
    return (
      <div aria-disabled className={base}>
        {inner}
      </div>
    );
  }
  
  return (
    <Link href={item.href} className={base}>
      {inner}
    </Link>
  );
}

function TabButton({
  icon,
  label,
  href,
  active,
}: {
  icon: typeof PlateIcon;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold tracking-wide transition-colors",
        active ? "text-accent" : "text-muted-foreground hover:text-white",
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center">
        <HugeiconsIcon icon={icon} size={22} strokeWidth={active ? 2.5 : 2} color="currentColor" />
      </div>
      {label}
    </Link>
  );
}
