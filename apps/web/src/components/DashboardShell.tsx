"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { MoreHorizontalIcon, Cancel01Icon, Logout01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/sign-out";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { CommandPalette, type PaletteCommand } from "@/components/CommandPalette";

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
    <Link href="/" className="inline-flex min-h-11 items-center text-xl font-black tracking-tighter">
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const moreCloseRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function apply(user: { email?: string; user_metadata?: Record<string, unknown> }) {
      setEmail(user.email ?? null);
      setDisplayName((user.user_metadata?.display_name as string) ?? null);
      setAvatarUrl((user.user_metadata?.avatar_url as string) ?? null);
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) apply(data.user);
    });
    // Settings edits the name/avatar; reflect it here without a page reload.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" && session?.user) apply(session.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // The "More" sheet is a real modal (role="dialog") but was keyboard-dead:
  // Escape didn't close it, opening never moved focus in, and closing never
  // gave it back to whatever button opened it.
  useEffect(() => {
    if (!moreOpen) return;
    moreTriggerRef.current = document.activeElement as HTMLElement | null;
    moreCloseRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      moreTriggerRef.current?.focus();
    };
  }, [moreOpen]);

  async function handleLogout() {
    await signOut();
    router.replace("/auth/login");
  }

  const commands = useMemo<PaletteCommand[]>(
    () => [
      ...NAV_ITEMS.filter((i) => !i.comingSoon).map((i) => ({
        id: i.href,
        label: i.label,
        hint: "Go to",
        icon: i.icon,
        run: () => router.push(i.href),
      })),
      {
        id: "sign-out",
        label: "Sign out",
        keywords: "logout log out",
        icon: Logout01Icon,
        run: () => {
          void signOut().then(() => router.replace("/auth/login"));
        },
      },
    ],
    [router],
  );

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

        <div className="px-4">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-left text-[13px] font-bold text-muted-foreground transition-colors hover:border-white/20 hover:text-white"
          >
            <HugeiconsIcon icon={Search01Icon} size={16} />
            <span className="flex-1">Search…</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:text-white"
          >
            <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={2} />
          </button>
          <Avatar initial={initial} imageUrl={avatarUrl} />
        </div>
      </header>

      {/* ── Main ── */}
      <main id="main-content" className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 pt-14 lg:ml-64 lg:pb-0 lg:pt-0">
        {/* Route-change animation lives in app/template.tsx; animating here too
            made every page fade in twice. */}
        <div className="flex h-full w-full flex-1 flex-col">{children}</div>
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

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />

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
                ref={moreCloseRef}
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
  // The full-size (sidebar) row draws its active state as a shared-layout pill
  // that glides between rows; the compact "More" sheet variant stays static
  // since both can be mounted at once and would fight over the layoutId.
  const slidingPill = active && !compact;
  const base = cn(
    "relative flex items-center gap-3 rounded-xl px-4 font-bold transition-colors",
    compact ? "py-3 text-sm bg-surface-2" : "py-3.5 text-[14px]",
    active
      ? compact ? "bg-accent text-black" : "text-black"
      : item.comingSoon
        ? "cursor-not-allowed opacity-40 text-muted-foreground"
        : compact ? "text-muted-foreground hover:text-white" : "text-muted-foreground hover:bg-surface-2 hover:text-white",
  );
  
  const inner = (
    <>
      {slidingPill && (
        <motion.span
          layoutId="nav-pill"
          transition={spring.snappy}
          className="absolute inset-0 -z-0 rounded-xl bg-accent"
        />
      )}
      <div className="relative flex h-6 w-6 items-center justify-center">
        <HugeiconsIcon icon={item.icon} size={20} strokeWidth={2} color="currentColor" />
      </div>
      <span className="relative flex-1 truncate">{item.label}</span>
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
      {active && (
        <motion.span
          layoutId="tab-indicator"
          transition={spring.snappy}
          className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
        />
      )}
      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={spring.snappy}
        className="flex h-6 w-6 items-center justify-center"
      >
        <HugeiconsIcon icon={icon} size={22} strokeWidth={active ? 2.5 : 2} color="currentColor" />
      </motion.div>
      {label}
    </Link>
  );
}
