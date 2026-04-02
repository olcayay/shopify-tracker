"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getMetadataLimits } from "@/lib/metadata-limits";
import { CharBadge, EditorField, mod } from "./shared";

export interface CanvaAppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  latestSnapshot: {
    appIntroduction: string;
    appDetails: string;
    developer: { name: string; url: string } | null;
    languages: string[];
    platformData?: {
      screenshots?: string[];
      permissions?: { scope: string; type: string }[];
      description?: string;
      termsUrl?: string;
      privacyUrl?: string;
      canvaAppType?: string;
    };
  } | null;
}

// Canva marketplace browse card
function CanvaBrowseCard({
  icon,
  name,
  description,
  nameChanged,
  descriptionChanged,
}: {
  icon: string | null;
  name: string;
  description: string;
  nameChanged: boolean;
  descriptionChanged: boolean;
}) {
  return (
    <div className="border border-[#e0e0e0] rounded-xl bg-white text-[#0d1216] hover:shadow-md transition-shadow w-[280px]">
      <div className="p-4 flex items-start gap-3">
        {icon ? (
          <img src={icon} alt="" aria-hidden="true" className="h-12 w-12 rounded-lg shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-[#f0f0f0] flex items-center justify-center text-lg font-bold shrink-0 text-[#7C3AED]">
            {name.charAt(0) || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={cn("text-[14px] font-semibold leading-tight", nameChanged && mod)}>
            {name || "App Name"}
          </p>
          <p className={cn("text-[12px] text-[#5b6068] line-clamp-2 leading-snug", descriptionChanged && mod)}>
            {description || "App description"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Permission item with thin checkmark like real Canva
function PermissionItem({ scope }: { scope: string }) {
  return (
    <div className="flex items-start gap-3">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0d1216] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-[15px] text-[#0d1216]">{scope}</span>
    </div>
  );
}

export function CanvaPreview({ appData }: { appData: CanvaAppData }) {
  const limits = getMetadataLimits("canva");
  const snapshot = appData.latestSnapshot;
  const pd = snapshot?.platformData;

  const [name, setName] = useState(appData.name || "");
  const [tagline, setTagline] = useState(snapshot?.appIntroduction || "");
  const [shortDesc, setShortDesc] = useState(pd?.description || "");
  const [details, setDetails] = useState(snapshot?.appDetails || "");

  function resetToOriginal() {
    setName(appData.name || "");
    setTagline(snapshot?.appIntroduction || "");
    setShortDesc(pd?.description || "");
    setDetails(snapshot?.appDetails || "");
  }

  const origName = appData.name || "";
  const origTagline = snapshot?.appIntroduction || "";
  const origShortDesc = pd?.description || "";
  const origDetails = snapshot?.appDetails || "";

  const nameChanged = name !== origName;
  const taglineChanged = tagline !== origTagline;
  const shortDescChanged = shortDesc !== origShortDesc;
  const detailsChanged = details !== origDetails;

  const developerName = snapshot?.developer?.name || "";
  const developerUrl = snapshot?.developer?.url || "";
  const screenshots = pd?.screenshots || [];
  const permissions = pd?.permissions || [];
  const languages = snapshot?.languages || [];
  const termsUrl = pd?.termsUrl || "";
  const privacyUrl = pd?.privacyUrl || "";
  const appType = pd?.canvaAppType || "";
  const icon = appData.iconUrl;

  return {
    resetToOriginal,
    preview: (
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Browse / Search Card */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
            Marketplace Browse Card
          </p>
          <div className="flex gap-4 flex-wrap">
            <CanvaBrowseCard
              icon={icon}
              name={name}
              description={shortDesc || tagline}
              nameChanged={nameChanged}
              descriptionChanged={shortDesc ? shortDescChanged : taglineChanged}
            />
          </div>
        </div>

        {/* App Detail Page */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
            App Detail Page
          </p>
          <div className="border rounded-2xl overflow-hidden bg-white text-[#0d1216]">
            {/* Top bar — Canva nav */}
            <div className="bg-white border-b border-[#e0e0e0] px-5 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#7C3AED" />
                  <text x="12" y="16" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">C</text>
                </svg>
                <span className="text-[13px] font-semibold text-[#0d1216]">Canva</span>
              </div>
              <span className="text-[#5b6068] text-[13px]">/</span>
              <span className="text-[13px] text-[#5b6068]">Apps</span>
            </div>

            {/* Two-column layout */}
            <div className="flex">
              {/* Left — Screenshot / Preview area */}
              <div className="w-[60%] shrink-0 p-5 bg-[#f5f5f5]">
                {screenshots.length > 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden bg-white shadow-sm">
                      <img
                        src={screenshots[0]}
                        alt="App screenshot"
                        className="w-full h-auto object-contain"
                      />
                    </div>
                    {screenshots.length > 1 && (
                      <div className="flex justify-center gap-1.5">
                        {screenshots.map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              i === 0 ? "bg-[#7C3AED]" : "bg-[#d0d0d0]"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[380px] rounded-xl bg-gradient-to-br from-[#f0ebff] to-[#e8e0ff] flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <svg viewBox="0 0 24 24" className="h-10 w-10 text-[#7C3AED]/30 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <p className="text-[12px] text-[#7C3AED]/50">No screenshots available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right — App details */}
              <div className="flex-1 min-w-0 p-8 space-y-6">
                {/* App header: large icon + name + created by */}
                <div className="flex items-center gap-4">
                  {icon ? (
                    <img src={icon} alt="" aria-hidden="true" className="h-16 w-16 rounded-2xl shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-[#f0ebff] flex items-center justify-center text-2xl font-bold shrink-0 text-[#7C3AED]">
                      {name.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className={cn("text-[17px] font-bold leading-snug", nameChanged && mod)}>
                      {name || "App Name"}
                    </h2>
                    <p className="text-[14px] text-[#5b6068]">
                      Created by{" "}
                      {developerUrl ? (
                        <span className="text-[#8B3DFF] underline cursor-pointer">{developerName}</span>
                      ) : (
                        <span>{developerName || "Developer"}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Tagline — large bold heading like real Canva */}
                {tagline && (
                  <h3 className={cn("text-[28px] font-bold leading-tight tracking-[-0.01em] text-[#0d1216]", taglineChanged && mod)}>
                    {tagline}
                  </h3>
                )}

                {/* Full description */}
                {details && (
                  <p className={cn("text-[16px] text-[#36404a] leading-relaxed whitespace-pre-line", detailsChanged && mod)}>
                    {details}
                  </p>
                )}

                {/* Permissions */}
                {permissions.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-[17px] font-bold text-[#0d1216]">Permissions</h4>
                    <p className="text-[14px] text-[#36404a]">When this app is open in a design, it can:</p>
                    <div className="space-y-2 pl-2">
                      {permissions.map((perm, i) => (
                        <PermissionItem key={i} scope={perm.scope} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional information */}
                <div className="space-y-3">
                  <h4 className="text-[17px] font-bold text-[#0d1216]">Additional information</h4>
                  <div className="bg-[#f5f5f5] rounded-xl p-4 space-y-1">
                    <p className="text-[13px] text-[#5b6068]">Developer</p>
                    <p className="text-[15px] font-semibold text-[#0d1216]">{developerName || "Unknown"}</p>
                    {developerUrl && (
                      <p className="text-[13px] text-[#8B3DFF] cursor-pointer">View developer information</p>
                    )}
                  </div>
                </div>

                {/* CTA button — rounded-full like real Canva */}
                <div className="pt-2 space-y-3">
                  <button className="w-full bg-[#8B3DFF] text-white text-[15px] font-semibold py-3.5 rounded-full hover:bg-[#7B2FEF] transition-colors">
                    Use in a design
                  </button>

                  {/* Terms / Privacy — full sentence like real Canva */}
                  {(termsUrl || privacyUrl) && (
                    <p className="text-[13px] text-[#36404a] leading-relaxed">
                      By using this app, you agree to its{" "}
                      {termsUrl && <span className="text-[#8B3DFF] underline cursor-pointer">Terms &amp; Conditions</span>}
                      {termsUrl && privacyUrl && " and "}
                      {privacyUrl && <span className="text-[#8B3DFF] underline cursor-pointer">Privacy policy</span>}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    editor: (
      <div className="space-y-5">
        <h3 className="font-semibold text-sm">Edit Listing Content</h3>

        <EditorField label="App Name" count={name.length} max={limits.appName} changed={nameChanged}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="App name"
            className={cn(
              nameChanged && "border-amber-500",
              name.length > limits.appName && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="Tagline" count={tagline.length} max={limits.subtitle} changed={taglineChanged}>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Short tagline for your app"
            rows={2}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              taglineChanged ? "border-amber-500" : "border-input",
              tagline.length > limits.subtitle && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="Short Description" count={shortDesc.length} max={limits.introduction} changed={shortDescChanged}>
          <textarea
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            placeholder="Short description for marketplace card"
            rows={3}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              shortDescChanged ? "border-amber-500" : "border-input",
              shortDesc.length > limits.introduction && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="Description" count={details.length} max={limits.details} changed={detailsChanged}>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Full app description"
            rows={8}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              detailsChanged ? "border-amber-500" : "border-input",
              details.length > limits.details && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>
      </div>
    ),
  };
}
