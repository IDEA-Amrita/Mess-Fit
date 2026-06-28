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
  /** Shown in the mobile bottom tab bar (max 4). The rest live in "More". */
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
    <Link href="/" className="text-lg font-bold tracking-tight">
      <span className="text-foreground">Mess</span>
      <span className="text-accent">Fit</span>
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

  // Close the mobile "More" sheet on navigation.
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
      {/* Skip to content — keyboard a11y (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* ── Desktop sidebar (≥lg) ── */}
      <aside className="fixed inset-y-4 left-4 hidden w-60 flex-col rounded-3xl border border-white/10 bg-white/5 backdrop-blur-3xl shadow-2xl lg:flex overflow-hidden">
        <div className="flex h-20 shrink-0 items-center border-b border-white/5 px-6">
          <Logo />
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar initial={initial} imageUrl={avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{displayLabel}</p>
              {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <HugeiconsIcon icon={Logout01Icon} className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (<lg) ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-background/60 px-5 backdrop-blur-2xl lg:hidden">
        <Logo />
        <Avatar initial={initial} imageUrl={avatarUrl} />
      </header>

      {/* ── Main ── */}
      <main id="main-content" className="flex min-h-screen flex-1 flex-col pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex-1 flex flex-col w-full h-full"
        >
          {children}
        </motion.div>
      </main>

      {/* ── Mobile bottom tab bar (<lg) ── */}
      <nav
        className="fixed inset-x-4 bottom-4 z-30 flex items-stretch rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl lg:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
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
            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
            moreOpen || onSecondaryRoute ? "text-accent" : "text-muted-foreground",
          )}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* ── Mobile "More" sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="mf-rise absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface-2 p-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map((item) => (
                <NavRow key={item.label} item={item} active={isActive(item.href)} compact />
              ))}
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
              Sign out
            </button>
          </div>
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
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
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
    "flex items-center gap-3 rounded-xl px-4 font-medium transition-all duration-300",
    compact ? "py-3 text-sm" : "py-3.5 text-sm",
    active
      ? "bg-accent/10 text-accent shadow-glow border border-accent/20 translate-x-1"
      : item.comingSoon
        ? "cursor-not-allowed text-muted-foreground/40"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground hover:translate-x-1",
  );
  const inner = (
    <>
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300", active ? "bg-accent/20" : "bg-transparent")}>
        <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.5} color="currentColor" />
      </div>
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon && (
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
      {active && (
        <motion.div
          layoutId="activeNavDesktop"
          className="absolute inset-0 rounded-xl bg-accent/10 border border-accent/20"
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-3 w-full">
        {inner}
      </div>
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
        "group relative flex flex-1 flex-col items-center justify-center gap-1.5 py-3 text-[10px] font-bold tracking-wide transition-all duration-300",
        active ? "text-accent" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <div className={cn("absolute -top-3 left-1/2 h-1 w-8 -translate-x-1/2 rounded-b-full bg-accent transition-all duration-300", active ? "opacity-100 shadow-[0_0_12px_rgba(245,158,11,0.8)]" : "opacity-0")} />
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300", active ? "bg-accent/20" : "bg-transparent group-hover:bg-white/5")}>
        <HugeiconsIcon icon={icon} size={22} strokeWidth={1.5} color="currentColor" />
      </div>
      {label}
    </Link>
  );
}
