"use client";
import { useEffect, useRef } from "react";
import {
  registerMailroomTools,
  type Registry,
  type MailroomAgentActions,
} from "../lib/mailroom-webmcp";
export function useMailroomWebMcp(
  active: boolean,
  actions: MailroomAgentActions,
) {
  const current = useRef(actions);
  current.current = actions;
  useEffect(() => {
    if (!active) return;
    const registry =
      (document as Document & { modelContext?: Registry }).modelContext ??
      (navigator as Navigator & { modelContext?: Registry }).modelContext;
    if (typeof registry?.registerTool !== "function") return;
    return registerMailroomTools(
      registry,
      {
        state: () => current.current.state(),
        checkSession: () => current.current.checkSession(),
        saveDraft: (m) => current.current.saveDraft(m),
        showReview: (m) => current.current.showReview(m),
      },
      () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
    );
  }, [active]);
}
