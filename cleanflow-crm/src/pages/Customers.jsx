import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Building2,
  Star,
  Contact2,
  Tag,
  X,
  LayoutGrid,
  Table2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import {
  Button,
  Card,
  Input,
  Textarea,
  Field,
  Badge,
  Avatar,
  Dialog,
  Drawer,
  Dropdown,
  DropdownItem,
  Spinner,
} from "../components/ui";
import { customersApi } from "../lib/services";
import { relative, shortDate } from "../lib/format";
import { cn } from "../lib/utils";

/* ─── useFlip ─────────────────────────────────────────────────────────────────
   FLIP animation: when the ordered list changes (e.g. a customer is starred and
   floats to the top), smoothly slide each card from its previous position to
   its new one. Reads element rects before/after the reorder and animates the
   inverse transform to zero. Respects prefers-reduced-motion.
   ──────────────────────────────────────────────────────────────────────────── */
function useFlip(dep) {
  const containerRef = useRef(null);
  const prevRects = useRef(new Map());

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll("[data-flip-id]"));

    // Measure all new positions first, before applying any transforms.
    const nextRects = new Map();
    nodes.forEach((n) => nextRects.set(n.dataset.flipId, n.getBoundingClientRect()));

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!reduce) {
      nodes.forEach((n) => {
        const oldRect = prevRects.current.get(n.dataset.flipId);
        const newRect = nextRects.get(n.dataset.flipId);
        if (!oldRect) return; // newly added card — no slide-in
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (dx || dy) {
          n.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "translate(0px, 0px)" },
            ],
            { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
        }
      });
    }

    prevRects.current = nextRects;
  }, [dep]);

  return containerRef;
}

/* ─── Customers page ──────────────────────────────────────────────────────────
   Full CRUD management: KPI strip, tag chip filter bar, card/table views,
   drawer detail, add/edit dialog (react-hook-form), delete confirm.
   All filtering is client-side for instant response.
   ──────────────────────────────────────────────────────────────────────────── */
export default function Customers() {
  // null = loading, [] = empty, [...] = loaded
  const [customers, setCustomers] = useState(null);
  const [filters, setFilters] = useState({ search: "", tag: "" });
  const [view, setView] = useState("grid"); // "grid" | "table"

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // customer being edited
  const [selected, setSelected] = useState(null); // customer open in drawer
  const [toDelete, setToDelete] = useState(null); // customer pending deletion
  const [deleting, setDeleting] = useState(false);
  const [favLoading, setFavLoading] = useState({}); // { [id]: bool }

  // Fetch all customers and store them
  const load = () => {
    setCustomers(null);
    customersApi
      .list()
      .then((res) => setCustomers(res.customers))
      .catch(() => setCustomers([]));
  };
  useEffect(load, []);

  // ── Derived data ────────────────────────────────────────────────────

  // Collect unique tags across all customers for the chip filter row
  const allTags = useMemo(() => {
    if (!customers) return [];
    const set = new Set();
    customers.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [customers]);

  // Per-tag counts (from all customers, not just filtered) for live chip counts
  const tagCounts = useMemo(() => {
    const c = { All: customers?.length || 0 };
    allTags.forEach((t) => {
      c[t] = (customers || []).filter((customer) =>
        (customer.tags || []).includes(t)
      ).length;
    });
    return c;
  }, [customers, allTags]);

  // KPI numbers computed from the full (unfiltered) customers list
  const kpis = useMemo(() => {
    const list = customers || [];
    const favorites = list.filter((c) => c.favorite).length;
    const uniqueCompanies = new Set(list.map((c) => c.company).filter(Boolean)).size;
    const tagged = list.filter((c) => (c.tags || []).length > 0).length;
    return { total: list.length, favorites, companies: uniqueCompanies, tagged };
  }, [customers]);

  // Client-side filtering: search by name/email/company and by tag
  const filtered = useMemo(() => {
    if (!customers) return [];
    return customers.filter((c) => {
      if (filters.tag && !(c.tags || []).includes(filters.tag)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, filters]);

  // Favorites float to the top; everything else keeps its relative order
  // (Array.prototype.sort is stable).
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)),
    [filtered]
  );

  const filtersActive = filters.search || filters.tag;

  // FLIP refs — animate cards/rows sliding to their new position on reorder.
  const gridRef = useFlip(ordered);
  const tableRef = useFlip(ordered);

  // ── Handlers ──────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (customer) => {
    setSelected(null);
    setEditing(customer);
    setFormOpen(true);
  };

  const handleSaved = () => load();

  // Toggle favorite star — optimistic in-place update (no full reload, so the
  // grid doesn't unmount and the scroll position is preserved).
  const toggleFavorite = async (e, customer) => {
    e.stopPropagation();
    if (favLoading[customer._id]) return;
    const next = !customer.favorite;
    setFavLoading((prev) => ({ ...prev, [customer._id]: true }));
    // Flip the star immediately in local state.
    setCustomers((prev) =>
      (prev || []).map((c) => (c._id === customer._id ? { ...c, favorite: next } : c))
    );
    try {
      await customersApi.update(customer._id, { favorite: next });
    } catch (err) {
      // Revert on failure.
      setCustomers((prev) =>
        (prev || []).map((c) =>
          c._id === customer._id ? { ...c, favorite: !next } : c
        )
      );
      toast.error(err?.message || "Could not update favorite");
    } finally {
      setFavLoading((prev) => ({ ...prev, [customer._id]: false }));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await customersApi.remove(toDelete._id);
      toast.success("Customer removed");
      setToDelete(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title="Customers"
        subtitle="Your people and professional relationships."
      >
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Add customer
        </Button>
      </PageHeader>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          tint="bg-brand-50 text-brand-600"
          label="Total customers"
          value={kpis.total}
        />
        <StatTile
          icon={Star}
          tint="bg-amber-50 text-amber-500"
          label="Favorites"
          value={kpis.favorites}
        />
        <StatTile
          icon={Building2}
          tint="bg-sky-50 text-sky-600"
          label="Companies"
          value={kpis.companies}
        />
        <StatTile
          icon={Tag}
          tint="bg-violet-50 text-violet-600"
          label="Tagged"
          value={kpis.tagged}
        />
      </div>

      {/* ── Toolbar Card ── */}
      <Card className="space-y-4 p-4">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by name, email, or company…"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
          />
        </div>

        {/* Tag chips + meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* "All" chip */}
          <TagChip
            label="All"
            count={tagCounts.All}
            active={!filters.tag}
            onClick={() => setFilters({ ...filters, tag: "" })}
          />
          {/* One chip per unique tag */}
          {allTags.map((t) => (
            <TagChip
              key={t}
              label={t}
              count={tagCounts[t] || 0}
              active={filters.tag === t}
              onClick={() =>
                setFilters({ ...filters, tag: filters.tag === t ? "" : t })
              }
            />
          ))}

          {/* Right-aligned controls */}
          <div className="ml-auto flex items-center gap-3">
            {filtersActive && (
              <button
                onClick={() => setFilters({ search: "", tag: "" })}
                className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft transition hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <span className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{filtered.length}</span> of{" "}
              {customers?.length ?? 0}
            </span>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
      </Card>

      {/* ── Results — loading / empty / grid / table ── */}
      {customers === null ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Contact2}
          title={filtersActive ? "No customers match" : "No customers yet"}
          description={
            filtersActive
              ? "Try different search terms or clear the tag filter."
              : "Add your first customer to start building your network."
          }
          action={
            !filtersActive ? (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Add customer
              </Button>
            ) : null
          }
        />
      ) : view === "grid" ? (
        /* ── Card grid view ── */
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {ordered.map((customer) => (
            <CustomerCard
              key={customer._id}
              customer={customer}
              flipId={customer._id}
              favLoading={!!favLoading[customer._id]}
              onToggleFavorite={toggleFavorite}
              onOpen={() => setSelected(customer)}
              onEdit={() => openEdit(customer)}
              onDelete={() => setToDelete(customer)}
            />
          ))}
        </div>
      ) : (
        /* ── Table view ── */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-6 py-3.5 font-medium">Customer</th>
                  <th className="px-6 py-3.5 font-medium">Title</th>
                  <th className="px-6 py-3.5 font-medium">Tags</th>
                  <th className="px-6 py-3.5 font-medium">Email</th>
                  <th className="px-6 py-3.5 font-medium">Phone</th>
                  <th className="px-6 py-3.5 w-24" />
                </tr>
              </thead>
              <tbody ref={tableRef}>
                {ordered.map((customer) => (
                  <CustomerTableRow
                    key={customer._id}
                    customer={customer}
                    flipId={customer._id}
                    favLoading={!!favLoading[customer._id]}
                    onToggleFavorite={toggleFavorite}
                    onOpen={() => setSelected(customer)}
                    onEdit={() => openEdit(customer)}
                    onDelete={() => setToDelete(customer)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Detail Drawer ── */}
      <CustomerDrawer
        open={Boolean(selected)}
        customer={selected}
        onClose={() => setSelected(null)}
        onEdit={() => openEdit(selected)}
        onDelete={() => setToDelete(selected)}
      />

      {/* ── Add / Edit Dialog ── */}
      <CustomerFormDialog
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove this customer?"
        description={`"${toDelete?.name}" will be permanently deleted and cannot be recovered.`}
        confirmLabel="Remove customer"
      />
    </div>
  );
}

/* ─── StatTile ───────────────────────────────────────────────────────────────
   KPI card: tinted icon square + label + large value.
   Copied from Leads' StatTile pattern.
   ──────────────────────────────────────────────────────────────────────────── */
function StatTile({ icon: Icon, label, value, tint }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            tint
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-soft">{label}</p>
          <p className="font-display text-lg font-bold text-ink">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/* ─── TagChip ────────────────────────────────────────────────────────────────
   Quick-filter pill for a single tag. Copied from Leads' StageChip pattern.
   ──────────────────────────────────────────────────────────────────────────── */
function TagChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "border-transparent bg-brand-600 text-white shadow-sm"
          : "border-line bg-surface text-ink-soft hover:text-ink hover:bg-surface-muted"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-xs font-semibold",
          active ? "bg-white/20 text-white" : "bg-surface-muted text-ink-soft"
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* ─── ViewToggle ─────────────────────────────────────────────────────────────
   Segmented Table2 / LayoutGrid icon toggle. Copied from Leads.
   ──────────────────────────────────────────────────────────────────────────── */
function ViewToggle({ view, onChange }) {
  const options = [
    { value: "grid", icon: LayoutGrid, label: "Card view" },
    { value: "table", icon: Table2, label: "Table view" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface-muted p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          title={label}
          aria-label={label}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition",
            view === value
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-soft hover:text-ink"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/* ─── CustomerCard ────────────────────────────────────────────────────────────
   Single premium customer tile for the card grid view.
   Shows avatar, name, title/company, favorite toggle, tags, email/phone.
   ──────────────────────────────────────────────────────────────────────────── */
function CustomerCard({
  customer,
  flipId,
  favLoading,
  onToggleFavorite,
  onOpen,
  onEdit,
  onDelete,
}) {
  return (
    <div
      data-flip-id={flipId}
      onClick={onOpen}
      className="relative cursor-pointer rounded-2xl border border-line bg-surface p-5 shadow-(--shadow-card) transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-pop)"
    >
      {/* Favorite star — top right, stopPropagation so card click doesn't fire */}
      <button
        onClick={(e) => onToggleFavorite(e, customer)}
        disabled={favLoading}
        aria-label={customer.favorite ? "Unmark favorite" : "Mark as favorite"}
        className="absolute right-4 top-4 rounded-lg p-1 text-ink-soft/40 transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <Star
          className={cn(
            "h-4 w-4 transition",
            customer.favorite ? "fill-amber-400 text-amber-400" : ""
          )}
        />
      </button>

      {/* Dropdown — positioned below the star */}
      <div
        className="absolute right-3 top-10 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Dropdown
          trigger={
            <button className="rounded-lg p-1.5 text-ink-soft/50 transition hover:bg-surface-muted hover:text-ink-soft">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          <DropdownItem onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownItem>
          <DropdownItem danger onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownItem>
        </Dropdown>
      </div>

      {/* Avatar + identity */}
      <div className="flex items-start gap-3 pr-8">
        <Avatar name={customer.name} size="md" />
        <div className="min-w-0">
          <p className="font-semibold text-ink leading-tight truncate">
            {customer.name}
          </p>
          {(customer.title || customer.company) && (
            <p className="mt-0.5 text-sm text-ink-soft truncate">
              {[customer.title, customer.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {customer.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {customer.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              className="bg-brand-50 text-brand-700 text-[11px] px-2 py-0.5"
            >
              {tag}
            </Badge>
          ))}
          {customer.tags.length > 3 && (
            <Badge className="bg-surface-muted text-ink-soft text-[11px] px-2 py-0.5">
              +{customer.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* customer info rows */}
      <div className="mt-3 space-y-1.5">
        {customer.email && (
          <div className="flex items-center gap-2 text-sm text-ink-soft min-w-0">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{customer.phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CustomerTableRow ────────────────────────────────────────────────────────
   Single row for the table view.
   ──────────────────────────────────────────────────────────────────────────── */
function CustomerTableRow({
  customer,
  flipId,
  favLoading,
  onToggleFavorite,
  onOpen,
  onEdit,
  onDelete,
}) {
  return (
    <tr
      data-flip-id={flipId}
      onClick={onOpen}
      className="group cursor-pointer border-b border-line last:border-0 transition hover:bg-surface-muted/50"
    >
      {/* Customer (avatar + name + company) */}
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size="sm" />
          <div>
            <p className="font-medium text-ink">{customer.name}</p>
            <p className="text-xs text-ink-soft">
              {customer.company || customer.email || "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Title */}
      <td className="px-6 py-3.5 text-sm text-ink-soft">
        {customer.title || "—"}
      </td>

      {/* Tags */}
      <td className="px-6 py-3.5">
        <div className="flex flex-wrap gap-1">
          {(customer.tags || []).slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              className="bg-brand-50 text-brand-700 text-[11px] px-2 py-0.5"
            >
              {tag}
            </Badge>
          ))}
          {(customer.tags || []).length > 2 && (
            <Badge className="bg-surface-muted text-ink-soft text-[11px] px-2 py-0.5">
              +{customer.tags.length - 2}
            </Badge>
          )}
          {!(customer.tags?.length) && (
            <span className="text-xs text-ink-soft/50">—</span>
          )}
        </div>
      </td>

      {/* Email */}
      <td className="px-6 py-3.5 text-sm text-ink-soft">
        {customer.email ? (
          <a
            href={`mailto:${customer.email}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-brand-700 hover:underline transition"
          >
            {customer.email}
          </a>
        ) : (
          "—"
        )}
      </td>

      {/* Phone */}
      <td className="px-6 py-3.5 text-sm text-ink-soft">
        {customer.phone || "—"}
      </td>

      {/* Actions */}
      <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {/* Favorite star */}
          <button
            onClick={(e) => onToggleFavorite(e, customer)}
            disabled={favLoading}
            aria-label={customer.favorite ? "Unmark favorite" : "Mark as favorite"}
            className="rounded-lg p-1.5 text-ink-soft/40 transition hover:text-amber-400"
          >
            <Star
              className={cn(
                "h-4 w-4 transition",
                customer.favorite ? "fill-amber-400 text-amber-400" : ""
              )}
            />
          </button>
          <Dropdown
            trigger={
              <button className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface-muted">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <DropdownItem onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownItem>
            <DropdownItem danger onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownItem>
          </Dropdown>
        </div>
      </td>
    </tr>
  );
}

/* ─── CustomerDrawer ──────────────────────────────────────────────────────────
   Right slide-over detail panel for a single customer.
   ──────────────────────────────────────────────────────────────────────────── */
function CustomerDrawer({ open, customer, onClose, onEdit, onDelete }) {
  if (!customer) return null;

  return (
    <Drawer open={open} onClose={onClose} title="customer details">
      <div className="space-y-6">
        {/* Identity hero */}
        <div className="flex items-center gap-4">
          <Avatar name={customer.name} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-ink">{customer.name}</h2>
              {customer.favorite && (
                <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
              )}
            </div>
            {(customer.title || customer.company) && (
              <p className="text-sm text-ink-soft mt-0.5">
                {[customer.title, customer.company].filter(Boolean).join(" · ")}
              </p>
            )}
            {customer.favorite && (
              <Badge className="mt-1.5 bg-amber-50 text-amber-700 text-[11px]">
                Favorite
              </Badge>
            )}
          </div>
        </div>

        {/* Customer fields */}
        <div className="rounded-2xl border border-line divide-y divide-line">
          {customer.email && (
            <DrawerRow icon={<Mail className="h-4 w-4" />} label="Email">
              <a
                href={`mailto:${customer.email}`}
                className="text-brand-700 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {customer.email}
              </a>
            </DrawerRow>
          )}
          {customer.phone && (
            <DrawerRow icon={<Phone className="h-4 w-4" />} label="Phone">
              <a
                href={`tel:${customer.phone}`}
                className="text-brand-700 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {customer.phone}
              </a>
            </DrawerRow>
          )}
          {customer.company && (
            <DrawerRow icon={<Building2 className="h-4 w-4" />} label="Company">
              <span className="text-ink">{customer.company}</span>
            </DrawerRow>
          )}
        </div>

        {/* Tags */}
        {customer.tags?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">
              <Tag className="h-3.5 w-3.5" /> Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((tag) => (
                <Badge key={tag} className="bg-brand-50 text-brand-700">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {customer.notes && (
          <div>
            <p className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">
              Notes
            </p>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line rounded-xl bg-surface-muted px-4 py-3">
              {customer.notes}
            </p>
          </div>
        )}

        {/* Meta */}
        <p className="text-xs text-ink-soft">
          Added {shortDate(customer.createdAt)}{" "}
          <span className="opacity-60">({relative(customer.createdAt)})</span>
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2 border-t border-line">
          <Button variant="outline" className="flex-1" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Single row in the drawer info table ── */
function DrawerRow({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-ink-soft shrink-0">{icon}</span>
      <span className="text-xs text-ink-soft w-16 shrink-0">{label}</span>
      <span className="text-sm min-w-0">{children}</span>
    </div>
  );
}

/* ─── CustomerFormDialog ──────────────────────────────────────────────────────
   Add / Edit dialog backed by react-hook-form.
   Tags are entered as a comma-separated string and split on submit.
   ──────────────────────────────────────────────────────────────────────────── */
function CustomerFormDialog({ open, customer, onClose, onSaved }) {
  const isEdit = Boolean(customer && customer._id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  // Reset form defaults when dialog opens or the editing target changes
  useEffect(() => {
    if (open) {
      reset(
        customer
          ? {
              name: customer.name || "",
              title: customer.title || "",
              company: customer.company || "",
              email: customer.email || "",
              phone: customer.phone || "",
              tags: (customer.tags || []).join(", "),
              notes: customer.notes || "",
              favorite: customer.favorite || false,
            }
          : {
              name: "",
              title: "",
              company: "",
              email: "",
              phone: "",
              tags: "",
              notes: "",
              favorite: false,
            }
      );
    }
  }, [open, customer, reset]);

  const onSubmit = async (values) => {
    // Parse comma-separated tags into a clean array
    const tags = values.tags
      ? values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const payload = { ...values, tags };

    try {
      if (isEdit) {
        await customersApi.update(customer._id, payload);
        toast.success("Customer updated");
      } else {
        await customersApi.create(payload);
        toast.success("Customer added");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit customer" : "New customer"}
      description={
        isEdit
          ? "Update the details below."
          : "Fill in the details to add a new customer."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
        {/* Name (required) */}
        <Field label="Full name" error={errors.name?.message}>
          <Input
            {...register("name", { required: "Name is required" })}
            placeholder="Jane Doe"
            autoFocus
          />
        </Field>

        {/* Title + Company in a two-column row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title">
            <Input {...register("title")} placeholder="Head of Design" />
          </Field>
          <Field label="Company">
            <Input {...register("company")} placeholder="Acme Inc." />
          </Field>
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input
              {...register("email")}
              type="email"
              placeholder="jane@acme.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              {...register("phone")}
              type="tel"
              placeholder="+1 555 000 0000"
            />
          </Field>
        </div>

        {/* Tags — comma-separated */}
        <Field label="Tags" error={errors.tags?.message}>
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input
              {...register("tags")}
              placeholder="e.g. client, vip, partner"
              className="pl-10"
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Separate multiple tags with commas.
          </p>
        </Field>

        {/* Notes */}
        <Field label="Notes">
          <Textarea
            {...register("notes")}
            placeholder="Any relevant context, history, or reminders…"
            rows={3}
          />
        </Field>

        {/* Favorite toggle */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 transition hover:bg-surface-muted select-none">
          <input
            type="checkbox"
            {...register("favorite")}
            className="h-4 w-4 rounded accent-brand-600"
          />
          <div>
            <p className="text-sm font-medium text-ink">Mark as favorite</p>
            <p className="text-xs text-ink-soft">
              Starred customers appear highlighted in your grid.
            </p>
          </div>
          <Star className="ml-auto h-4 w-4 text-amber-400" />
        </label>

        {/* Form actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add customer"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
