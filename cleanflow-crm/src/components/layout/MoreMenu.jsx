import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const MENU_WIDTH = 224;
const MENU_GAP = 12;
const MENU_MARGIN = 12;

export function MoreMenu({ open, anchorRef, items, onClose }) {
  const location = useLocation();
  const menuRef = useRef(null);
  const isOpenRef = useRef(open);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

  useEffect(() => {
    isOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (isOpenRef.current) {
      onClose?.();
    }
  }, [location.pathname, onClose]);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchorEl = anchorRef?.current;
      if (!anchorEl) {
        setPosition((current) => ({ ...current, ready: false }));
        return;
      }

      const rect = anchorEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuHeight = menuRef.current?.offsetHeight ?? 0;

      const preferredLeft = rect.right + MENU_GAP;
      const preferredTop = rect.top + rect.height / 2 - menuHeight / 2;

      const maxLeft = viewportWidth - MENU_WIDTH - MENU_MARGIN;
      const left = Math.max(MENU_MARGIN, Math.min(preferredLeft, maxLeft));
      const top = Math.max(
        MENU_MARGIN,
        Math.min(preferredTop, viewportHeight - MENU_MARGIN - menuHeight)
      );

      setPosition({ top, left, ready: true });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      const anchorEl = anchorRef?.current;
      const menuEl = menuRef.current;
      if (anchorEl && anchorEl.contains(event.target)) return;
      if (menuEl && menuEl.contains(event.target)) return;
      onClose?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        "fixed rounded-2xl border border-line bg-surface p-2 shadow-(--shadow-pop)",
        "transition duration-150 ease-out",
        position.ready ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
      )}
      style={{
        width: `${MENU_WIDTH}px`,
        top: `${position.top}px`,
        left: `${position.left}px`,
        transformOrigin: "top left",
      }}
      role="menu"
      aria-label="More navigation"
      aria-hidden={!position.ready}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => onClose?.()}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
              isActive ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-surface-muted"
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </div>,
    document.body
  );
}
