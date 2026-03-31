"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Pause,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { ConfirmModal } from "@/components/confirm-modal";
import { useFormatDate } from "@/lib/format-date";

interface QueueStatusCardProps {
  queueStatus: any;
  onTogglePause: () => void;
  onDrainQueue: () => void;
  onClearFailed: () => void;
  onRemoveJob: (jobId: string) => void;
  onKillJob: (jobId: string) => void;
}

export function QueueStatusCard({
  queueStatus,
  onTogglePause,
  onDrainQueue,
  onClearFailed,
  onRemoveJob,
  onKillJob,
}: QueueStatusCardProps) {
  const { formatDateTime } = useFormatDate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [drainConfirm, setDrainConfirm] = useState(false);
  const [clearFailedConfirm, setClearFailedConfirm] = useState(false);
  const [killJobConfirm, setKillJobConfirm] = useState<{ id: string; type: string } | null>(null);

  if (!queueStatus) return null;

  const hasQueueJobs =
    queueStatus.counts.waiting > 0 ||
    queueStatus.counts.active > 0 ||
    queueStatus.counts.delayed > 0 ||
    queueStatus.counts.failed > 0;

  // Auto-expand when there are jobs
  const collapsed = isCollapsed && !hasQueueJobs;

  return (
    <>
      <Card className={queueStatus.isPaused ? "border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20" : hasQueueJobs ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className="text-base">
                Queue Status
                {queueStatus.isPaused && (
                  <Badge variant="secondary" className="ml-2">Paused</Badge>
                )}
                {!hasQueueJobs && !queueStatus.isPaused && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">Empty</span>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onTogglePause}
              >
                {queueStatus.isPaused ? (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    Pause
                  </>
                )}
              </Button>
              {queueStatus.counts.waiting > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setDrainConfirm(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Waiting
                </Button>
              )}
              {queueStatus.counts.failed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setClearFailedConfirm(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Failed
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {!collapsed && (
          <CardContent>
            {hasQueueJobs ? (
              <>
                {/* Per-queue breakdown */}
                {queueStatus.queues && (
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {(["interactive", "background"] as const).map((qName) => {
                      const q = queueStatus.queues[qName];
                      if (!q) return null;
                      const qHasJobs = q.counts.waiting > 0 || q.counts.active > 0 || q.counts.delayed > 0 || q.counts.failed > 0;
                      return (
                        <div key={qName} className="flex flex-col gap-1 p-2 rounded-md border bg-background">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{qName}</span>
                            {q.isPaused && <Badge variant="secondary" className="text-[10px] py-0">Paused</Badge>}
                          </div>
                          {qHasJobs ? (
                            <div className="flex gap-3 text-xs">
                              <span><span className="text-muted-foreground">Active:</span> {q.counts.active}</span>
                              <span><span className="text-muted-foreground">Waiting:</span> {q.counts.waiting}</span>
                              {q.counts.delayed > 0 && <span><span className="text-muted-foreground">Delayed:</span> {q.counts.delayed}</span>}
                              {q.counts.failed > 0 && <span className="text-destructive">Failed: {q.counts.failed}</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">Queues are empty — no jobs waiting or running.</p>
            )}
            {queueStatus.jobs.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Queued At</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueStatus.jobs.map((job: any) => (
                    <TableRow key={`${job.queue}-${job.id}`}>
                      <TableCell className="font-mono text-xs">
                        {job.id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {job.type}
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.data?.platform ? (
                          <Badge variant="outline" className="capitalize text-xs">
                            {job.data.platform}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {job.queue || "background"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            job.status === "active"
                              ? "secondary"
                              : job.status === "failed"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.createdAt
                          ? formatDateTime(job.createdAt)
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.data?.slug && (
                          <span className="text-muted-foreground">
                            app: {job.data.slug}
                          </span>
                        )}
                        {job.data?.keyword && (
                          <span className="text-muted-foreground">
                            keyword: {job.data.keyword}
                          </span>
                        )}
                        {job.failedReason && (
                          <CopyableError error={job.failedReason} />
                        )}
                      </TableCell>
                      <TableCell>
                        {job.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setKillJobConfirm({ id: job.id, type: job.type })}
                            title="Kill job"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveJob(job.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      <ConfirmModal
        open={drainConfirm}
        title="Clear Waiting Jobs"
        description={`All ${queueStatus?.counts.waiting ?? 0} waiting jobs will be removed from both queues. Active jobs will not be affected. This action cannot be undone.`}
        confirmLabel="Clear All"
        onConfirm={() => { onDrainQueue(); setDrainConfirm(false); }}
        onCancel={() => setDrainConfirm(false)}
      />
      <ConfirmModal
        open={clearFailedConfirm}
        title="Clear Failed Jobs"
        description={`All ${queueStatus?.counts.failed ?? 0} failed jobs will be removed from both queues. This action cannot be undone.`}
        confirmLabel="Clear All"
        onConfirm={() => { onClearFailed(); setClearFailedConfirm(false); }}
        onCancel={() => setClearFailedConfirm(false)}
      />
      <ConfirmModal
        open={killJobConfirm !== null}
        title="Kill Active Job"
        description={`This will forcefully remove the active "${killJobConfirm?.type}" job (${killJobConfirm?.id}). The job will be terminated and cannot be recovered.`}
        confirmLabel="Kill Job"
        onConfirm={() => {
          if (killJobConfirm) {
            onKillJob(killJobConfirm.id);
            setKillJobConfirm(null);
          }
        }}
        onCancel={() => setKillJobConfirm(null)}
      />
    </>
  );
}

function CopyableError({ error }: { error: string }) {
  return (
    <div className="relative group inline">
      <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded whitespace-pre-wrap break-words max-h-16 overflow-y-auto inline-block">
        {error.slice(0, 120)}{error.length > 120 ? "..." : ""}
      </pre>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={error} variant="icon" size="xs" />
      </div>
    </div>
  );
}
