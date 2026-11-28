export interface TraceNode {
  id: string;
  contractId: string;
  functionName: string;
  depth: number;
  status: "ok" | "error" | "pending";
  gasUsed: number;
  result?: string;
  children: TraceNode[];
}

export interface Trace {
  traceId: string;
  ledger: number;
  durationMs: number;
  nodes: TraceNode[];
}
