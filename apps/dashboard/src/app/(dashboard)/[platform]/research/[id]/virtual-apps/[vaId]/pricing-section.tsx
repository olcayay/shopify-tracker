"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import { CompetitorPricingReference } from "./competitor-pricing-reference";
import type { VirtualAppEditorState } from "./use-virtual-app-editor";

export function PricingSection({ state }: { state: VirtualAppEditorState }) {
  const {
    canEdit,
    research,
    pricingPlans,
    editingPlanIndex,
    setEditingPlanIndex,
    setDeletePlanConfirm,
    sortedPricingPlans,
    addPricingPlan,
    updatePricingPlan,
    addPlanFeature,
    updatePlanFeature,
    removePlanFeature,
  } = state;

  return (
    <Card id="sec-pricing" className="scroll-mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" /> Pricing Plans
          <Badge variant="secondary" className="text-xs">{pricingPlans.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Competitor Pricing Reference */}
        {research && research.competitors.some((c) => (c.pricingPlans || []).length > 0) && (
          <CompetitorPricingReference competitors={research.competitors} />
        )}

        {/* Plan cards row */}
        {sortedPricingPlans.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sortedPricingPlans.map(({ plan, originalIdx }) => {
              const isEditing = editingPlanIndex === originalIdx;
              return (
                <div
                  key={originalIdx}
                  className="border rounded-lg p-4 min-w-[240px] max-w-[280px] shrink-0 space-y-3 relative"
                >
                  {isEditing ? (
                    /* ── Edit mode ── */
                    <>
                      {canEdit && (
                        <button
                          onClick={() => setDeletePlanConfirm(originalIdx)}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                          title="Delete plan"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <Input
                        value={plan.name}
                        onChange={(e) => updatePricingPlan(originalIdx, { name: e.target.value })}
                        disabled={!canEdit}
                        placeholder="Plan name"
                        className="h-8 text-sm font-medium"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={plan.price || ""}
                          onChange={(e) => updatePricingPlan(originalIdx, { price: e.target.value || null })}
                          disabled={!canEdit}
                          placeholder="0 = Free"
                          className="h-8 text-sm flex-1"
                          type="number"
                          min="0"
                          step="0.01"
                        />
                        <select
                          value={plan.period || "month"}
                          onChange={(e) => updatePricingPlan(originalIdx, { period: e.target.value })}
                          disabled={!canEdit}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="month">/ month</option>
                          <option value="year">/ year</option>
                        </select>
                      </div>
                      <Input
                        value={plan.trial_text || ""}
                        onChange={(e) => updatePricingPlan(originalIdx, { trial_text: e.target.value || null })}
                        disabled={!canEdit}
                        placeholder="Trial text (optional)"
                        className="h-8 text-sm"
                      />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Features</p>
                        <div className="space-y-1">
                          {plan.features.map((feat, fi) => (
                            <div key={fi} className="flex gap-1">
                              <Input
                                value={feat}
                                onChange={(e) => updatePlanFeature(originalIdx, fi, e.target.value)}
                                disabled={!canEdit}
                                placeholder={`Feature ${fi + 1}`}
                                className="h-7 text-xs flex-1"
                              />
                              {canEdit && (
                                <button
                                  onClick={() => removePlanFeature(originalIdx, fi)}
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addPlanFeature(originalIdx)}
                            className="text-xs mt-1 h-6 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add feature
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full mt-1"
                        onClick={() => setEditingPlanIndex(null)}
                      >
                        Done
                      </Button>
                    </>
                  ) : (
                    /* ── View mode ── */
                    <>
                      {canEdit && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={() => setEditingPlanIndex(originalIdx)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Edit plan"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletePlanConfirm(originalIdx)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete plan"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-sm font-medium pr-12">{plan.name || "Unnamed Plan"}</p>
                      <p className="text-xl font-bold">
                        {plan.price && parseFloat(plan.price) > 0 ? `$${plan.price}` : "Free"}
                        {plan.price && parseFloat(plan.price) > 0 && plan.period && (
                          <span className="text-xs font-normal text-muted-foreground"> / {plan.period}</span>
                        )}
                      </p>
                      {plan.trial_text && (
                        <p className="text-xs text-emerald-600">{plan.trial_text}</p>
                      )}
                      {plan.features.length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          {plan.features.filter(Boolean).map((feat, fi) => (
                            <p key={fi} className="text-xs text-muted-foreground">{feat}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {/* Add plan button */}
            {canEdit && (
              <button
                onClick={addPricingPlan}
                className="border-2 border-dashed rounded-lg min-w-[120px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add Plan</span>
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No pricing plans yet.</p>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={addPricingPlan}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Pricing Plan
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
