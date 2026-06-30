import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  Contact2,
  KanbanSquare,
  StickyNote,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { useState, useRef, useCallback } from "react";
import { MoreMenu } from "./MoreMenu";

/* Primary nav as an icon-only rail (reference style): a floating rounded
   column, active item rendered as a solid green circle, with settings /
   logout pinned to the bottom. */
const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/customers", label: "Customers", icon: Contact2 },
  { to: "/jobs", label: "Jobs", icon: KanbanSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
];

const MORE_NAV = [
  { to: "/services", label: "Services", icon: Sparkles },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/tasks", label: "Follow-ups", icon: CalendarCheck },
];

function RailLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        cn(
          "group relative flex h-11 w-11 items-center justify-center rounded-2xl transition",
          isActive
            ? "brand-gradient text-white shadow-sm"
            : "text-ink-soft hover:bg-surface-muted hover:text-ink",
        )
      }
    >
      <Icon className="h-5 w-5" />
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 lg:block animate-in fade-in zoom-in-95 duration-150">
        {label}
      </span>
    </NavLink>
  );
}

export function IconRail() {
  const { logout } = useAuth();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const buttonRef = useRef(null);
  const location = useLocation();
  const isMoreActive = MORE_NAV.some((item) => item.to === location.pathname);
  const handleMoreClose = useCallback(() => {
    setIsMoreOpen(false);
  }, []);

  return (
    <aside className="flex h-full flex-col items-center justify-center gap-2 py-4">
      {/* Primary nav */}
      <nav className="flex flex-col items-center gap-2">
        {PRIMARY_NAV.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}

        <button
          ref={buttonRef}
          onClick={() => setIsMoreOpen((current) => !current)}
          title="More"
          aria-label="More navigation"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl transition",
            isMoreOpen || isMoreActive
              ? "brand-gradient text-white shadow-sm"
              : "text-ink-soft hover:bg-surface-muted hover:text-ink",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <MoreMenu
          open={isMoreOpen}
          anchorRef={buttonRef}
          items={MORE_NAV}
          onClose={handleMoreClose}
        />
      </nav>

      {/* Divider then settings + logout — kept within the vertically centered group */}
      <div className="my-1 h-px w-6 bg-line" />
      <RailLink to="/settings" label="Settings" icon={Settings} />
      <button
        onClick={logout}
        title="Log out"
        className="flex h-11 w-11 items-center justify-center rounded-2xl text-ink-soft transition hover:bg-rose-50 hover:text-rose-600"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  );
}
