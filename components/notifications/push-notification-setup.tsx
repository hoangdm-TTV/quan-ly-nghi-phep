'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';

function encodeApplicationServerKey(key: string): ArrayBuffer {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

export default function PushNotificationSetup() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const isSupported = window.isSecureContext
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    setSupported(isSupported);
    if (!isSupported) return;

    if (Notification.permission === 'granted') {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setEnabled(Boolean(subscription)))
        .catch(() => undefined);
    }

    const playTing = () => {
      const context = audioContext.current;
      if (!context || context.state !== 'running') return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1046, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1318, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.4);
    };
    navigator.serviceWorker.addEventListener('message', playTing);
    return () => navigator.serviceWorker.removeEventListener('message', playTing);
  }, []);

  async function enableNotifications() {
    if (!supported) return;
    setBusy(true);
    setMessage('');
    try {
      if (!audioContext.current) audioContext.current = new AudioContext();
      await audioContext.current.resume();
      if (Notification.permission === 'denied') {
        throw new Error('Thông báo đang bị chặn trong cài đặt trình duyệt.');
      }
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Bạn chưa cho phép gửi thông báo.');

      const keyResponse = await fetch('/api/notifications/vapid-public-key');
      const keyData = await keyResponse.json();
      if (!keyResponse.ok || !keyData.publicKey) {
        throw new Error(keyData.error || 'Không lấy được cấu hình thông báo đẩy.');
      }

      await navigator.serviceWorker.register('/service-worker.js');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const expectedKey = new Uint8Array(encodeApplicationServerKey(keyData.publicKey));
      if (subscription) {
        const currentKey = subscription.options.applicationServerKey;
        const keyMatches = currentKey
          && new Uint8Array(currentKey).length === expectedKey.length
          && new Uint8Array(currentKey).every((byte, index) => byte === expectedKey[index]);
        if (!keyMatches) {
          await fetch('/api/notifications/subscription', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
          subscription = null;
        }
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: expectedKey.buffer,
        });
      }
      const saveResponse = await fetch('/api/notifications/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      if (!saveResponse.ok) {
        const saveData = await saveResponse.json().catch(() => ({}));
        throw new Error(saveData.error || 'Không lưu được thiết bị nhận thông báo. Vui lòng chạy migration 003 rồi thử lại.');
      }
      const testResponse = await fetch('/api/notifications/test', { method: 'POST' });
      const testData = await testResponse.json();
      if (!testResponse.ok) throw new Error(testData.error || 'Đã lưu thiết bị nhưng chưa gửi được push thử.');
      setSoundReady(true);
      setEnabled(true);
      setMessage('Đã bật thông báo. Bạn vừa nhận push thử; dashboard đang mở sẽ phát tiếng ting.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể bật thông báo trên thiết bị này.');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-amber-700" role="status">
        Trình duyệt hoặc địa chỉ hiện tại chưa hỗ trợ thông báo đẩy. Hãy dùng Chrome, Edge, Firefox hoặc Safari phiên bản mới trên HTTPS; iPhone/iPad cần thêm ứng dụng vào Màn hình chính.
      </p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={enableNotifications}
        disabled={busy || (enabled && soundReady)}
        title={enabled && soundReady
          ? 'Thông báo và tiếng chuông đã bật trên thiết bị này'
          : enabled
            ? 'Thông báo đẩy đã bật. Bấm để bật tiếng chuông cho phiên này.'
            : 'Bật thông báo đẩy và tiếng chuông'}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${enabled ? 'border-emerald-200 bg-emerald-50 text-[#005a3c]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} disabled:cursor-default`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled && soundReady ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        <span className="hidden lg:inline">{enabled && soundReady ? 'Đã bật thông báo' : enabled ? 'Bật tiếng chuông' : 'Bật thông báo'}</span>
      </button>
      {message && (
        <p role="status" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}
