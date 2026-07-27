"use client";

// 专注模式 (focus mode) — collapses the back-office chrome so an iPad station
// gives the whole screen to the work, plus 大字 for readability at arm's length.
//
// WHAT WE HONESTLY CAN AND CANNOT DO: iOS/iPadOS Safari does not let a web page
// hide its own address bar (the Fullscreen API is effectively video-only there).
// So this collapses OUR chrome — sidebar + top bar — and the settings page
// teaches "Add to Home Screen", which is the only way to actually lose Safari's
// frame. We never call requestFullscreen and pretend it worked.
//
// 大字 uses CSS `zoom`, NOT a font-size bump. The floor plan is a spatial map:
// nodes are absolutely positioned at PERCENTAGE coordinates inside a fixed
// aspect-ratio canvas. Scaling type alone would grow the node boxes while their
// positions stayed put, and tables would overlap — the map would stop matching
// the real room. `zoom` scales positions and boxes together, so the layout is
// preserved exactly. Same reason focus mode must never change the canvas's
// aspect ratio, only its size.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type FocusState = {
  focus: boolean;
  setFocus: (v: boolean) => void;
  big: boolean;
  setBig: (v: boolean) => void;
  /** Multiplier for CSS zoom — 1 when 大字 is off. */
  scale: number;
};

const Ctx = createContext<FocusState>({
  focus: false,
  setFocus: () => {},
  big: false,
  setBig: () => {},
  scale: 1,
});

export const useFocus = () => useContext(Ctx);

const FOCUS_KEY = "bento_focus_mode";
const BIG_KEY = "bento_focus_big";
/** Matches the customer menu's 大字 (app/menu/[tenant] uses 1.18) so staff and
 *  diners experience the same step up, not two different "large" sizes. */
export const BIG_SCALE = 1.18;

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocusState] = useState(false);
  const [big, setBigState] = useState(false);

  // Restore per DEVICE: a station iPad stays focused across reloads, while the
  // owner's laptop keeps the normal shell. Read after mount so SSR markup and
  // the first client paint agree (no hydration mismatch).
  useEffect(() => {
    try {
      setFocusState(localStorage.getItem(FOCUS_KEY) === "on");
      setBigState(localStorage.getItem(BIG_KEY) === "on");
    } catch {
      /* private mode — defaults are fine */
    }
  }, []);

  const setFocus = useCallback((v: boolean) => {
    setFocusState(v);
    try { localStorage.setItem(FOCUS_KEY, v ? "on" : "off"); } catch { /* ignore */ }
  }, []);

  const setBig = useCallback((v: boolean) => {
    setBigState(v);
    try { localStorage.setItem(BIG_KEY, v ? "on" : "off"); } catch { /* ignore */ }
  }, []);

  // Esc leaves focus mode — a keyboard/lost user always has a way out even if
  // the exit button scrolled somewhere unexpected.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFocus(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, setFocus]);

  return (
    <Ctx.Provider value={{ focus, setFocus, big, setBig, scale: big ? BIG_SCALE : 1 }}>
      {children}
    </Ctx.Provider>
  );
}
