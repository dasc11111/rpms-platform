"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell, BellOff, Check, CheckCheck, ChevronRight, Loader2,
  RefreshCw, Trash2, AlertTriangle, AlertCircle, Info, Shield,
  Activity, GraduationCap, Wrench, Flame, FileText, Zap,
  X, Filter,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  type: "danger" | "warning" | "info" | "success";
  category: string;
  title: string;
  message: string | null;
  module: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

interface Stats {
  total: string;
  unread: string;
  danger: string;
  warning: string;
  info: string;
}

interface CategoryStat {
  category: string;
  total: string;
  unread: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  danger:  { label: "Peligro",    icon: AlertCircle,   bg: "bg-red-50 border-red-200",    badge: "bg-red-100 text-red-800",    dot: "bg-red-500" },
  warning: { label: "Advertencia",icon: AlertTriangle,  bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  info:    { label: "Info",       icon: Info,           bg: "bg-blue-50 border-blue-200",  badge: "bg-blue-100 text-blue-800",  dot: "bg-blue-500" },
  success: { label: "OK",         icon: Check,          bg: "bg-green-50 border-green-200",badge: "bg-green-100 text-green-800",dot: "bg-green-500" },
} as const;

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  dosimetria:    Activity,
  calibracion:   Wrench,
  capacitacion:  GraduationCap,
  fuente:        Zap,
  emergencia:    Flame,
  cumplimiento:  Shield,
  documento:     FileText,
  sistema:       Bell,
};

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Date(isoStr).toLocaleDateString("es-CL");
}

// ─── Notification Card ───────────────────────────────────────────────────────

function NotifCard({
  n,
  onRead,
  onDelete,
}: {
  n: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
  const Icon = CATEGORY_ICON[n.category] ?? Bell;

  return (
    <div className={cn(
      "relative flex gap-3 p-4 border rounded-lg transition-all",
      !n.is_read ? cn(cfg.bg, "shadow-sm") : "bg-card border-border opacity-70",
    )}>
      {/* Unread dot */}
      {!n.is_read && (
        <span className={cn("absolute top-3 right-3 w-2 h-2 rounded-full", cfg.dot)} />
      )}

      {/* Type icon */}
      <div className={cn("mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        n.type === "danger"  ? "bg-red-100" :
        n.type === "warning" ? "bg-amber-100" :
        n.type === "success" ? "bg-green-100" : "bg-blue-100"
      )}>
        <Icon className={cn("w-4 h-4",
          n.type === "danger"  ? "text-red-600" :
          n.type === "warning" ? "text-amber-600" :
          n.type === "success" ? "text-green-600" : "text-blue-600"
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={cn("inline-block text-xs font-medium px-1.5 py-0.5 rounded mb-1 mr-1.5", cfg.badge)}>
              {cfg.label}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{n.category}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{relativeTime(n.created_at)}</span>
        </div>

        <p className={cn("text-sm font-semibold", n.is_read ? "font-medium" : "font-semibold")}>
          {n.title}
        </p>
        {n.message && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          {n.action_url && (
            <Link
              href={n.action_url}
              onClick={() => !n.is_read && onRead(n.id)}
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Ver detalle <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          {!n.is_read && (
            <button
              onClick={() => onRead(n.id)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Marcar leído
            </button>
          )}
          <button
            onClick={() => onDelete(n.id)}
            className="text-xs text-muted-foreground hover:text-red-600 inline-flex items-center gap-1 ml-auto"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<Stats>({ total: "0", unread: "0", danger: "0", warning: "0", info: "0" });
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selCategory, setSelCategory] = useState("");
  const [marking, setMarking] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.set("unread_only", "true");
      if (selCategory) params.set("category", selCategory);
      const res = await fetch(`/api/notifications?${params}`);
      const json = await res.json();
      setNotifications(json.notifications ?? []);
      setStats(json.stats ?? { total: "0", unread: "0", danger: "0", warning: "0", info: "0" });
      setCategories(json.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, selCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", ids: [id] }),
    });
  }, []);

  const deleteNotif = useCallback(async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [id] }),
    });
  }, []);

  const markAllRead = useCallback(async () => {
    setMarking(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setStats(prev => ({ ...prev, unread: "0" }));
    } finally {
      setMarking(false);
    }
  }, []);

  const unreadCount = parseInt(stats.unread);
  const dangerCount = parseInt(stats.danger);
  const warningCount = parseInt(stats.warning);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Centro de Notificaciones
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Alertas y avisos del sistema de radioprotección
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted text-muted-foreground"
            >
              {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Marcar todas leídas
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Sin leer", value: stats.unread, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Peligro", value: stats.danger, color: "text-red-700", bg: dangerCount > 0 ? "bg-red-50 border-red-200" : "bg-muted/50" },
          { label: "Advertencia", value: stats.warning, color: "text-amber-700", bg: warningCount > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/50" },
        ].map(chip => (
          <div key={chip.label} className={cn("rounded-lg border p-3 text-center", chip.bg)}>
            <p className={cn("text-xl font-bold", chip.color)}>{chip.value}</p>
            <p className="text-xs text-muted-foreground">{chip.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
            unreadOnly ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {unreadOnly ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
          {unreadOnly ? "Mostrando: sin leer" : "Solo sin leer"}
        </button>

        {/* Category filters */}
        {categories.map(cat => (
          <button
            key={cat.category}
            onClick={() => setSelCategory(selCategory === cat.category ? "" : cat.category)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border capitalize transition-colors",
              selCategory === cat.category
                ? "bg-blue-600 text-white border-blue-600"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {cat.category}
            {parseInt(cat.unread) > 0 && (
              <span className={cn("ml-1 font-bold", selCategory === cat.category ? "text-white" : "text-blue-600")}>
                {cat.unread}
              </span>
            )}
          </button>
        ))}

        {(unreadOnly || selCategory) && (
          <button
            onClick={() => { setUnreadOnly(false); setSelCategory(""); }}
            className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Cargando notificaciones…
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BellOff className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {unreadOnly || selCategory ? "Sin notificaciones con estos filtros" : "Sin notificaciones"}
          </p>
          {(unreadOnly || selCategory) && (
            <button
              onClick={() => { setUnreadOnly(false); setSelCategory(""); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Group: Unread */}
          {notifications.some(n => !n.is_read) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Sin leer ({notifications.filter(n => !n.is_read).length})
              </p>
              <div className="space-y-2">
                {notifications
                  .filter(n => !n.is_read)
                  .map(n => (
                    <NotifCard key={n.id} n={n} onRead={markRead} onDelete={deleteNotif} />
                  ))}
              </div>
            </div>
          )}

          {/* Group: Read */}
          {notifications.some(n => n.is_read) && !unreadOnly && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Leídas ({notifications.filter(n => n.is_read).length})
              </p>
              <div className="space-y-2">
                {notifications
                  .filter(n => n.is_read)
                  .map(n => (
                    <NotifCard key={n.id} n={n} onRead={markRead} onDelete={deleteNotif} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground border-t pt-4 flex items-center justify-between">
        <span>Las notificaciones se generan automáticamente desde los módulos del sistema.</span>
        <Link href="/settings/notifications" className="text-blue-600 hover:underline">
          Configurar alertas →
        </Link>
      </div>
    </div>
  );
}
