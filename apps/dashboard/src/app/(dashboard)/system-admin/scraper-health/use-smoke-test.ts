"use client";

import { useState, useCallback, useRef } from "react";
import type { SmokeCheckName, PlatformId } from "@appranks/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getAccessToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)access_token=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export type CellStatus = "pending" | "running" | "pass" | "fail" | "na";

export interface CellResult {
  platform: string;
  check: SmokeCheckName;
  status: CellStatus;
  durationMs?: number;
  output?: string;
  error?: string;
  startedAt?: number;
  traceId?: string;
}

export interface SmokeTestProgress {
  completed: number;
  total: number;
  running: number;
}

export interface SmokeTestSummary {
  passed: number;
  failed: number;
  na: number;
  totalDurationMs: number;
}

function cellKey(platform: string, check: string): string {
  return `${platform}:${check}`;
}

export function useSmokeTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Map<string, CellResult>>(new Map());
  const [progress, setProgress] = useState<SmokeTestProgress>({
    completed: 0,
    total: 0,
    running: 0,
  });
  const [summary, setSummary] = useState<SmokeTestSummary | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runningCountRef = useRef(0);

  const start = useCallback(async (filter?: { platform?: string; check?: SmokeCheckName }) => {
    const isPartialRun = !!(filter?.platform || filter?.check);

    if (isPartialRun) {
      // Partial run: reset only targeted cells, keep the rest
      setResults((prev) => {
        const next = new Map(prev);
        for (const [key] of next) {
          const [p, c] = key.split(":");
          const matchesPlatform = !filter.platform || p === filter.platform;
          const matchesCheck = !filter.check || c === filter.check;
          if (matchesPlatform && matchesCheck) {
            next.set(key, { platform: p, check: c as SmokeCheckName, status: "pending" });
          }
        }
        return next;
      });
    } else {
      // Full run: reset everything
      setResults(new Map());
    }
    setProgress({ completed: 0, total: 0, running: 0 });
    setSummary(null);
    setIsRunning(true);
    runningCountRef.current = 0;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const token = getAccessToken();
    try {
      const params = new URLSearchParams();
      if (filter?.platform) params.set("platform", filter.platform);
      if (filter?.check) params.set("check", filter.check);
      const qs = params.toString();

      const response = await fetch(
        `${API_BASE}/api/system-admin/scraper/smoke-test${qs ? `?${qs}` : ""}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        }
      );

      if (!response.ok || !response.body) {
        setIsRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              handleSSEEvent(currentEvent, parsed);
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Smoke test SSE error:", err);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }

    function handleSSEEvent(event: string, data: any) {
      switch (event) {
        case "init":
          setProgress((p) => ({ ...p, total: data.totalChecks }));
          break;

        case "start":
          runningCountRef.current++;
          setResults((prev) => {
            const next = new Map(prev);
            next.set(cellKey(data.platform, data.check), {
              platform: data.platform,
              check: data.check,
              status: "running",
              startedAt: Date.now(),
            });
            return next;
          });
          setProgress((p) => ({
            ...p,
            running: runningCountRef.current,
          }));
          break;

        case "complete":
          runningCountRef.current--;
          setResults((prev) => {
            const next = new Map(prev);
            next.set(cellKey(data.platform, data.check), {
              platform: data.platform,
              check: data.check,
              status: data.status,
              durationMs: data.durationMs,
              output: data.output,
              error: data.error,
              traceId: data.traceId,
            });
            return next;
          });
          setProgress((p) => ({
            ...p,
            completed: p.completed + 1,
            running: runningCountRef.current,
          }));
          break;

        case "summary":
          setSummary({
            passed: data.passed,
            failed: data.failed,
            na: data.na,
            totalDurationMs: data.totalDurationMs,
          });
          break;

        case "done":
          setIsRunning(false);
          break;
      }
    }
  }, []);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  const retryCheck = useCallback(
    async (
      platform: string,
      check: SmokeCheckName
    ): Promise<CellResult> => {
      const key = cellKey(platform, check);

      // Set running state
      setResults((prev) => {
        const next = new Map(prev);
        next.set(key, {
          platform,
          check,
          status: "running",
          startedAt: Date.now(),
        });
        return next;
      });

      const token = getAccessToken();
      try {
        const res = await fetch(
          `${API_BASE}/api/system-admin/scraper/smoke-test/check`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ platform, check }),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          const result: CellResult = {
            platform,
            check,
            status: "fail",
            error: err.error || `HTTP ${res.status}`,
          };
          setResults((prev) => {
            const next = new Map(prev);
            next.set(key, result);
            return next;
          });
          return result;
        }

        const data = await res.json();
        const result: CellResult = {
          platform,
          check,
          status: data.status,
          durationMs: data.durationMs,
          output: data.output,
          error: data.error,
        };

        setResults((prev) => {
          const next = new Map(prev);
          next.set(key, result);
          return next;
        });

        // Update summary counts if we had a previous summary
        setSummary((prev) => {
          if (!prev) return prev;
          // Recalculate from results
          return prev; // Will be recalculated from results in the UI
        });

        return result;
      } catch (err: any) {
        const result: CellResult = {
          platform,
          check,
          status: "fail",
          error: err.message,
        };
        setResults((prev) => {
          const next = new Map(prev);
          next.set(key, result);
          return next;
        });
        return result;
      }
    },
    []
  );

  return {
    isRunning,
    results,
    progress,
    summary,
    start,
    stop,
    retryCheck,
  };
}
