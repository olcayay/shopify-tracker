"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function apiCall(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "dev-secret-key",
      ...(options?.headers || {}),
    },
  });
  return res.json();
}

export default function AdminPage() {
  const [appSlug, setAppSlug] = useState("");
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const [runs, setRuns] = useState<any[]>([]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const addApp = async () => {
    if (!appSlug.trim()) return;
    const result = await apiCall("/api/admin/tracked-apps", {
      method: "POST",
      body: JSON.stringify({ slug: appSlug.trim() }),
    });
    showMessage(`App "${result.slug}" added to tracking.`);
    setAppSlug("");
  };

  const addKeyword = async () => {
    if (!keyword.trim()) return;
    const result = await apiCall("/api/admin/tracked-keywords", {
      method: "POST",
      body: JSON.stringify({ keyword: keyword.trim() }),
    });
    showMessage(`Keyword "${result.keyword}" added.`);
    setKeyword("");
  };

  const triggerScraper = async (type: string) => {
    const result = await apiCall("/api/admin/scraper/trigger", {
      method: "POST",
      body: JSON.stringify({ type }),
    });
    showMessage(result.message || `Scraper "${type}" triggered.`);
  };

  const loadRuns = async () => {
    const data = await apiCall("/api/admin/scraper/runs?limit=10");
    setRuns(data);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-md text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Track App */}
        <Card>
          <CardHeader>
            <CardTitle>Track App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="App slug (e.g. formful)"
              value={appSlug}
              onChange={(e) => setAppSlug(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addApp()}
            />
            <Button onClick={addApp} className="w-full">
              Add App
            </Button>
          </CardContent>
        </Card>

        {/* Track Keyword */}
        <Card>
          <CardHeader>
            <CardTitle>Track Keyword</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Keyword (e.g. form builder)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            />
            <Button onClick={addKeyword} className="w-full">
              Add Keyword
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Scrapers */}
      <Card>
        <CardHeader>
          <CardTitle>Trigger Scrapers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => triggerScraper("category")}
            >
              Categories
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerScraper("app_details")}
            >
              App Details
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerScraper("keyword_search")}
            >
              Keywords
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerScraper("reviews")}
            >
              Reviews
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scraper Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Scraper Runs</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadRuns}>
            Load Runs
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length > 0 ? (
            <div className="space-y-2">
              {runs.map((run: any) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        run.status === "completed"
                          ? "default"
                          : run.status === "running"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {run.status}
                    </Badge>
                    <span className="font-mono text-sm">
                      {run.scraperType}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleString()
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Click &quot;Load Runs&quot; to see recent scraper runs.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
