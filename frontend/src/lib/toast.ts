import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";
export interface Toast { id: string; kind: ToastKind; message: string }

interface ToastStore {
  toasts: Toast[];
  dismiss: (id: string) => void;
  show: (kind: ToastKind, message: string) => void;
}

// Tiếng "ping" ngắn báo thành công (WebAudio, không cần file âm thanh).
function beep(kind: ToastKind) {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = kind === "error" ? 240 : 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => ctx.close();
  } catch { /* trình duyệt chặn audio → bỏ qua */ }
}

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  show: (kind, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    beep(kind);
    setTimeout(() => get().dismiss(id), 3200);
  },
}));

/** Gọi nhanh ở bất kỳ đâu: toast.success("Đã lưu"). */
export const toast = {
  success: (m: string) => useToasts.getState().show("success", m),
  error: (m: string) => useToasts.getState().show("error", m),
  info: (m: string) => useToasts.getState().show("info", m),
};
