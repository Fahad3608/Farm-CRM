import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { Icon } from "@/components/icons";
import { logoutAction } from "@/app/actions/auth";
import NavLink from "@/components/NavLink";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const farmName =
    (await prisma.setting.findUnique({ where: { key: "farmName" } }).catch(() => null))?.value ?? "Farm CRM";

  const isVet = user.role === "VET";

  type NavItem = { href: string; label: string; icon: (p: { className?: string }) => React.JSX.Element };

  const mainNav = [
    !isVet && { href: "/dashboard", label: "Dashboard", icon: Icon.dashboard },
    isVet && { href: "/vet", label: "My Queue", icon: Icon.dashboard },
    { href: "/animals", label: "Animals", icon: Icon.animals },
    { href: "/health", label: "Health", icon: Icon.syringe },
    can.viewBreeding(user.role) && { href: "/breeding", label: "Breeding", icon: Icon.breeding },
    !isVet && { href: "/milk", label: "Milk", icon: Icon.milk },
    !isVet && { href: "/feed", label: "Feed", icon: Icon.feed },
  ].filter(Boolean) as NavItem[];

  const spendingNav = can.viewFinance(user.role)
    ? [
        { href: "/equipment", label: "Equipment & construction", icon: Icon.batch },
        { href: "/batches", label: "Batches", icon: Icon.batch },
      ]
    : [];

  const bottomNav = [
    can.viewFinance(user.role) && { href: "/finance", label: "Finance", icon: Icon.finance },
    can.viewFinance(user.role) && { href: "/customers", label: "Customers", icon: Icon.customers },
    can.manageSettings(user.role) && { href: "/settings", label: "Settings", icon: Icon.settings },
  ].filter(Boolean) as NavItem[];

  const allNav = [...mainNav, ...spendingNav, ...bottomNav];

  const mobileNav = mainNav.slice(0, 5);

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={32} height={32} className="rounded-lg" />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold leading-tight">{farmName}</div>
            <div className="truncate text-[12px] text-muted">{ROLE_LABEL[user.role]}</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-2">
          <div className="flex flex-col gap-0.5">
            {mainNav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label}>
                <item.icon />
              </NavLink>
            ))}
          </div>

          {spendingNav.length > 0 && (
            <div className="mt-4 flex flex-col gap-0.5">
              <span className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Spending</span>
              {spendingNav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label}>
                  <item.icon />
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-line p-2">
          {bottomNav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label}>
              <item.icon />
            </NavLink>
          ))}
          <div className="mt-2 border-t border-line pt-2">
            <div className="px-2 py-1.5">
              <div className="truncate text-[13px] font-medium">{user.name}</div>
              <div className="truncate text-[12px] text-muted">{user.email}</div>
            </div>
            <form action={logoutAction}>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-muted hover:bg-surface2 hover:text-ink">
                <Icon.logout /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight">{farmName}</div>
          <div className="truncate text-[11.5px] text-muted">{user.name} · {ROLE_LABEL[user.role]}</div>
        </div>
        {can.manageSettings(user.role) && (
          <Link href="/settings" aria-label="Settings" className="rounded-lg p-2 text-muted hover:bg-surface2">
            <Icon.settings />
          </Link>
        )}
        <form action={logoutAction}>
          <button aria-label="Sign out" className="rounded-lg p-2 text-muted hover:bg-surface2"><Icon.logout /></button>
        </form>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {mobileNav.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} variant="tab">
            <item.icon />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
