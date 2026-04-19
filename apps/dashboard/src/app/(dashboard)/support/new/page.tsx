"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { TYPE_LABELS } from "@/components/support/ticket-badges";

const TICKET_TYPES = Object.entries(TYPE_LABELS);

export default function NewTicketPage() {
  const { fetchWithAuth } = useAuth();
  const router = useRouter();
  const [type, setType] = useState("general_inquiry");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    setSubmitting(true);
    const res = await fetchWithAuth("/api/support-tickets", {
      method: "POST",
      body: JSON.stringify({ type, subject: subject.trim(), body: body.trim() }),
    });

    if (res.ok) {
      const ticket = await res.json();
      toast.success("Ticket created successfully");
      router.push(`/support/${ticket.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to create ticket");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/support">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">New Support Ticket</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How can we help?</CardTitle>
          <CardDescription>
            Describe your issue and our team will get back to you as soon as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                {TICKET_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                required
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your issue in detail. Include any relevant context, steps to reproduce, or screenshots."
                required
                rows={8}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[120px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/support">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting || !subject.trim() || !body.trim()}>
                <Send className="h-4 w-4 mr-1" />
                {submitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
