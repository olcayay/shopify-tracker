"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/password-strength";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, UserPlus } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface InvitationInfo {
  email: string;
  role: string;
  expired: boolean;
  accepted: boolean;
  inviterName: string;
  accountName: string;
  accountCompany?: string | null;
}

function setCookie(name: string, value: string, maxAge: number) {
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Accept invitation
      const res = await fetch(
        `${API_BASE}/api/invitations/accept/${params.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, password }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to accept invitation");
        return;
      }

      setSuccess(true);

      // Auto-login with the credentials just set
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invitation!.email, password }),
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        setCookie("access_token", data.accessToken, 900);
        setCookie("refresh_token", data.refreshToken, 7 * 86400);
        router.push("/");
      } else {
        // Login failed — redirect to login page as fallback
        setTimeout(() => router.push("/login"), 1500);
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
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
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
            Account created. Signing you in...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">
          Join {invitation.accountName}
        </CardTitle>
        <CardDescription className="space-y-1">
          <span className="block">
            <strong>{invitation.inviterName}</strong> invited you to join as{" "}
            <strong>{invitation.role}</strong>
          </span>
          {invitation.accountCompany && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {invitation.accountCompany}
            </span>
          )}
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
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={invitation.email}
              readOnly
              className="bg-muted cursor-not-allowed"
            />
          </div>
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
            <PasswordStrength password={password} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : `Join ${invitation.accountName}`}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
