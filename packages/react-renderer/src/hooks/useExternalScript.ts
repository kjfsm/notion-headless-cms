"use client";

import { useEffect, useState } from "react";

// 同一 URL のスクリプト要素を 1 度だけ <head> に挿入し、状態を共有するためのモジュールスコープ管理。
// 複数の Twitter embed が同時に存在しても widgets.js を 1 回だけロードする。
const cache = new Map<string, "loading" | "loaded" | "error">();
const listeners = new Map<string, Set<() => void>>();

function notify(src: string) {
  for (const listener of listeners.get(src) ?? []) listener();
}

export type ScriptStatus = "idle" | "loading" | "loaded" | "error";

export function useExternalScript(src: string | null): ScriptStatus {
  const [status, setStatus] = useState<ScriptStatus>(() => {
    if (!src) return "idle";
    return cache.get(src) ?? "idle";
  });

  useEffect(() => {
    if (!src) return;
    if (typeof document === "undefined") return;

    const existing = cache.get(src);
    if (existing === "loaded") {
      setStatus("loaded");
      return;
    }

    const set = listeners.get(src) ?? new Set<() => void>();
    const update = () => setStatus(cache.get(src) ?? "idle");
    set.add(update);
    listeners.set(src, set);

    if (!existing) {
      cache.set(src, "loading");
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => {
        cache.set(src, "loaded");
        notify(src);
      };
      el.onerror = () => {
        cache.set(src, "error");
        notify(src);
      };
      document.head.appendChild(el);
      setStatus("loading");
    } else {
      setStatus(existing);
    }

    return () => {
      set.delete(update);
    };
  }, [src]);

  return status;
}
