import { useState, useCallback } from "react";
import type { Trace, TraceNode } from "../types/trace.js";

interface UseTraceReturn {
  trace: Trace | null;
  isLoading: boolean;
  error: string | null;
  loadTrace: (traceId: string) => Promise<void>;
  clearTrace: () => void;
}

/**
 * Manage the lifecycle of a single Soroban execution trace.
 *
 * Returns the flat node list (`trace.nodes`) which is consumed by
 * ExecutionTimeline for virtualised rendering.
 */
export function useTrace(): UseTraceReturn {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrace = useCallback(async (traceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/replay/${traceId}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ??
            `HTTP ${response.status}`
        );
      }
      const { data } = await response.json() as { data: Trace };
      setTrace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trace");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearTrace = useCallback(() => {
    setTrace(null);
    setError(null);
  }, []);

  return { trace, isLoading, error, loadTrace, clearTrace };
}
