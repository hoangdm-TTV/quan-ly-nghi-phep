"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

function encodeApplicationServerKey(key: string): ArrayBuffer {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

export default function PushNotificationSetup({
  alwaysShowLabel = false,
}: {
  alwaysShowLabel?: boolean;
}) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [isIosSafariBrowser, setIsIosSafariBrowser] = useState(false);
  const [denied, setDenied] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeoutId = window.setTimeout(() => setMessage(""), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        Boolean((window.navigator as { standalone?: boolean }).standalone));

    if (isIOS && !isStandalone) {
      setIsIosSafariBrowser(true);
    }

    const isSupported =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);
    if (!isSupported) return;

    // 1. Phát hiện ngay nếu người dùng đã lỡ tắt / chặn thông báo
    if (Notification.permission === "denied") {
      setDenied(true);
      setEnabled(false);
    } else if (Notification.permission === "granted") {
      setDenied(false);
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setEnabled(Boolean(subscription)))
        .catch(() => undefined);
    }

    // 2. Lắng nghe trực tiếp khi người dùng đổi quyền trong Cài đặt trình duyệt
    if ("permissions" in navigator && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          status.onchange = () => {
            const isBlocked = status.state === "denied";
            setDenied(isBlocked);
            if (isBlocked) setEnabled(false);
          };
        })
        .catch(() => undefined);
    }

    const playTing = () => {
      const context = audioContext.current;
      if (!context || context.state !== "running") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1046, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        1318,
        context.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.38,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.4);
    };

    const handlePushMessage = () => {
      playTing();
      router.refresh();
    };

    navigator.serviceWorker.addEventListener("message", handlePushMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handlePushMessage);
  }, [router]);

  async function enableNotifications() {
    if (!supported) return;

    // Nếu đang bị chặn, hiển thị hướng dẫn mở lại ngay khi bấm nút
    if (Notification.permission === "denied") {
      setDenied(true);
      const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
      setMessage(
        isIOS
          ? "Bạn đã tắt thông báo. Hãy vào Cài đặt iPhone → tìm ứng dụng này → Thông báo → bật Cho phép thông báo, sau đó bấm lại nút này."
          : "Bạn đã chặn thông báo. Hãy bấm vào biểu tượng Ổ khóa / Cài đặt bên trái thanh địa chỉ web → Quyền → chuyển Thông báo sang Cho phép, rồi tải lại trang.",
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission === "denied") {
        setDenied(true);
        throw new Error(
          "Bạn vừa chọn Chặn thông báo. Để nhận tin duyệt đơn, hãy mở Cài đặt trình duyệt/điện thoại và cấp lại quyền Thông báo.",
        );
      }

      if (permission !== "granted") {
        throw new Error("Bạn chưa cho phép gửi thông báo.");
      }

      setDenied(false);

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          if (!audioContext.current) audioContext.current = new AudioCtx();
          if (audioContext.current.state === "suspended") {
            await audioContext.current.resume();
          }
          setSoundReady(true);
        }
      } catch {
        // Bỏ qua lỗi audio trên iOS
      }

      const keyResponse = await fetch("/api/notifications/vapid-public-key");
      const keyData = await keyResponse.json();
      if (!keyResponse.ok || !keyData.publicKey) {
        throw new Error(
          keyData.error || "Không lấy được cấu hình thông báo đẩy.",
        );
      }

      await navigator.serviceWorker.register("/service-worker.js");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const expectedKey = new Uint8Array(
        encodeApplicationServerKey(keyData.publicKey),
      );

      if (subscription) {
        const currentKey = subscription.options.applicationServerKey;
        const keyMatches =
          currentKey &&
          new Uint8Array(currentKey).length === expectedKey.length &&
          new Uint8Array(currentKey).every(
            (byte, index) => byte === expectedKey[index],
          );
        if (!keyMatches) {
          await fetch("/api/notifications/subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
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

      const saveResponse = await fetch("/api/notifications/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!saveResponse.ok) {
        const saveData = await saveResponse.json().catch(() => ({}));
        throw new Error(
          saveData.error || "Không lưu được thiết bị nhận thông báo.",
        );
      }

      const testResponse = await fetch("/api/notifications/test", {
        method: "POST",
      });
      const testData = await testResponse.json();
      if (!testResponse.ok) {
        throw new Error(
          testData.error || "Đã lưu thiết bị nhưng chưa gửi được push thử.",
        );
      }

      setEnabled(true);
      setMessage("Đã bật thông báo đẩy thành công trên thiết bị này.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể bật thông báo trên thiết bị này.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-amber-700" role="status">
        {isIosSafariBrowser
          ? 'Trên iPhone/iPad: Bấm nút Chia sẻ (↑) ở thanh dưới → chọn "Thêm vào MH chính", sau đó mở ứng dụng từ màn hình chính để bật thông báo.'
          : "Cần truy cập qua HTTPS (hoặc localhost) để bật thông báo đẩy."}
      </p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={enableNotifications}
        disabled={busy || (enabled && soundReady && !denied)}
        title={
          denied
            ? "Thông báo đang bị chặn trên trình duyệt. Bấm để xem cách bật lại."
            : enabled && soundReady
              ? "Thông báo và tiếng chuông đã bật trên thiết bị này"
              : enabled
                ? "Thông báo đẩy đã bật. Bấm để bật tiếng chuông cho phiên này."
                : "Bật thông báo đẩy và tiếng chuông"
        }
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
          denied
            ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
            : enabled
              ? "border-emerald-200 bg-emerald-50 text-[#005a3c]"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        } disabled:cursor-default`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : denied ? (
          <BellOff className="h-4 w-4" />
        ) : enabled && soundReady ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span className={alwaysShowLabel ? "inline" : "hidden 2xl:inline"}>
          {denied
            ? "Thông báo bị chặn"
            : enabled && soundReady
              ? "Đã bật thông báo"
              : enabled
                ? "Bật tiếng chuông"
                : "Bật thông báo"}
        </span>
      </button>
      {message && (
        <p
          role="status"
          className={`${alwaysShowLabel ? "mt-2 w-full" : "absolute right-0 top-full z-50 mt-2 w-72 shadow-lg"} rounded-lg border p-3 text-xs ${
            denied
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
