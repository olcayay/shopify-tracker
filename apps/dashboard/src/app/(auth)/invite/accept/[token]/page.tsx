"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface InvitationInfo {
  email: string;
  role: string;
  expired: boolean;
  accepted: boolean;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      try {
        const res = await fetch(
          `${API_BASE}/api/invitations/${params.token}`
        );
        if (res.ok) {
          setInvitation(await res.json());
        } else {
          const data = await res.json().catch(() => ({}));
          setLoadError(data.error || "Invitation not found");
        }
      } catch {
        setLoadError("Failed to load invitation");
      }
    }
    loadInvitation();
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/invitations/accept/${params.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, password }),
        }
      );

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to accept invitation");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!invitation) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          Loading invitation...
        </CardContent>
      </Card>
    );
  }

  if (invitation.expired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation Expired</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This invitation has expired. Please ask for a new one.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (invitation.accepted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Already Accepted</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This invitation has already been accepted.{" "}
            <a href="/login" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Account created. Redirecting to login...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept Invitation</CardTitle>
        <CardDescription>
          You&apos;ve been invited as <strong>{invitation.role}</strong> for{" "}
          <strong>{invitation.email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Accept & Create Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
