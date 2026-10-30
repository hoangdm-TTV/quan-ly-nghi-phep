'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.notifications || []);
      setUnread(Number(data.unread || 0));
    } catch {
      // Thông báo là tính năng bổ trợ, không làm ảnh hưởng giao diện chính.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function markRead(item: NotificationItem) {
    if (!item.read_at) {
      setUnread((value) => Math.max(0, value - 1));
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) }).catch(() => undefined);
    }
    setOpen(false);
    if (item.url) router.push(item.url);
  }

  async function markAllRead() {
    setLoading(true);
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }).catch(() => undefined);
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnread(0);
    setLoading(false);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Thông báo" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-black leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-bold text-slate-900">Thông báo</p><p className="text-[11px] text-slate-500">{unread ? `${unread} thông báo chưa đọc` : 'Bạn đã xem hết thông báo'}</p></div>{unread > 0 && <button type="button" onClick={markAllRead} disabled={loading} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#005a3c] hover:underline">{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />} Đọc tất cả</button>}</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? <p className="p-6 text-center text-xs text-slate-400">Chưa có thông báo nào.</p> : items.map((item) => <button type="button" key={item.id} onClick={() => markRead(item)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${item.read_at ? 'bg-white' : 'bg-emerald-50/50'}`}><div className="flex gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-slate-200' : 'bg-emerald-500'}`} /><div className="min-w-0"><p className="text-xs font-bold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.body}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(item.created_at)}</p></div></div></button>)}
        </div>
      </div>}
    </div>
  );
}
