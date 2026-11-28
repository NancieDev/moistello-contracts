import { useState, useEffect, useCallback } from "react";
import type { TraceNode } from "../types/trace.js";

export interface Breakpoint {
  /** `${contractId}::${functionName}` */
  key: string;
  contractId: string;
  functionName: string;
  enabled: boolean;
  /** ISO timestamp when the breakpoint was created. */
  createdAt: string;
}

type StoredBreakpoints = Record<string, Breakpoint>;

const STORAGE_KEY_PREFIX = "dripswave:breakpoints:";

function storageKey(contractId: string): string {
  return `${STORAGE_KEY_PREFIX}${contractId}`;
}

function breakpointKey(contractId: string, functionName: string): string {
  return `${contractId}::${functionName}`;
}

function readFromStorage(contractId: string): StoredBreakpoints {
  try {
    const raw = localStorage.getItem(storageKey(contractId));
    if (!raw) return {};
    return JSON.parse(raw) as StoredBreakpoints;
  } catch {
    return {};
  }
}

function writeToStorage(contractId: string, bps: StoredBreakpoints): void {
  try {
    localStorage.setItem(storageKey(contractId), JSON.stringify(bps));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}

function removeFromStorage(contractId: string): void {
  try {
    localStorage.removeItem(storageKey(contractId));
  } catch {
    // ignore
  }
}

interface UseBreakpointsReturn {
  breakpoints: Breakpoint[];
  addBreakpoint: (contractId: string, functionName: string) => void;
  removeBreakpoint: (key: string) => void;
  toggleBreakpoint: (key: string) => void;
  clearAll: () => void;
  /**
   * Reconcile loaded breakpoints against the current trace nodes.
   * Any breakpoint whose contractId+functionName does not appear in the
   * trace is dropped. Call this whenever the trace changes.
   */
  reconcile: (nodes: TraceNode[]) => void;
}

/**
 * Manage per-contract breakpoints with localStorage persistence.
 *
 * Breakpoints are stored under the key:
 *   `dripswave:breakpoints:{contractId}`
 *
 * On mount the hook restores breakpoints from storage. When the active
 * trace changes, call `reconcile(nodes)` to drop stale breakpoints.
 */
export function useBreakpoints(contractId: string): UseBreakpointsReturn {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(() => {
    const stored = readFromStorage(contractId);
    return Object.values(stored);
  });

  // Persist to localStorage whenever breakpoints change
  useEffect(() => {
    const record: StoredBreakpoints = {};
    for (const bp of breakpoints) {
      record[bp.key] = bp;
    }
    if (breakpoints.length === 0) {
      removeFromStorage(contractId);
    } else {
      writeToStorage(contractId, record);
    }
  }, [breakpoints, contractId]);

  // Re-load when contractId changes (user switches contract)
  useEffect(() => {
    const stored = readFromStorage(contractId);
    setBreakpoints(Object.values(stored));
  }, [contractId]);

  const addBreakpoint = useCallback(
    (cId: string, functionName: string) => {
      const key = breakpointKey(cId, functionName);
      setBreakpoints((prev) => {
        if (prev.some((bp) => bp.key === key)) return prev; // already exists
        return [
          ...prev,
          {
            key,
            contractId: cId,
            functionName,
            enabled: true,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    },
    []
  );

  const removeBreakpoint = useCallback((key: string) => {
    setBreakpoints((prev) => prev.filter((bp) => bp.key !== key));
  }, []);

  const toggleBreakpoint = useCallback((key: string) => {
    setBreakpoints((prev) =>
      prev.map((bp) =>
        bp.key === key ? { ...bp, enabled: !bp.enabled } : bp
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setBreakpoints([]);
  }, []);

  const reconcile = useCallback((nodes: TraceNode[]) => {
    const liveKeys = new Set(
      nodes.map((n) => breakpointKey(n.contractId, n.functionName))
    );
    setBreakpoints((prev) => prev.filter((bp) => liveKeys.has(bp.key)));
  }, []);

  return {
    breakpoints,
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    clearAll,
    reconcile,
  };
}
