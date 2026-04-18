"use client";

import { TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";
import { KeywordSuggestionsModal } from "@/components/keyword-suggestions-modal";
import { KeywordTagFilter } from "@/components/keyword-tag-filter";
import { KeywordWordGroupFilter } from "@/components/keyword-word-group-filter";
import { MetadataKeywordSuggestions } from "@/components/metadata-keyword-suggestions";
import { KeywordsAppSelector } from "./keywords-app-selector";
import { KeywordsSearchInput } from "./keywords-search-input";
import { KeywordsTable } from "./keywords-table";
import { useKeywordsSection } from "./use-keywords-section";

export function KeywordsSection({ appSlug }: { appSlug: string }) {
  const state = useKeywordsSection(appSlug);

  return (
    <div className="space-y-4">
      {/* App selector bar */}
      <KeywordsAppSelector
        mainApp={state.mainApp}
        competitors={state.competitors}
        selectedSlugs={state.selectedSlugs}
        dragIndex={state.dragIndex}
        dragOverIndex={state.dragOverIndex}
        onToggleCompetitor={state.toggleCompetitor}
        onToggleAll={state.toggleAll}
        onDragStart={state.handleDragStart}
        onDragOver={state.handleDragOver}
        onDrop={state.handleDrop}
        onDragEnd={state.handleDragEnd}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Keywords for this app
          {state.account
            ? ` (${state.account.usage.trackedKeywords}/${state.account.limits.maxTrackedKeywords} unique across all apps)`
            : ""}
        </p>
      </div>

      {state.message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{state.message}</div>
      )}

      {state.canEdit && (
        <KeywordsSearchInput
          query={state.query}
          suggestions={state.suggestions}
          showSuggestions={state.showSuggestions}
          searchLoading={state.searchLoading}
          trackedKeywordIds={state.trackedKeywordIds}
          onSearchInput={state.handleSearchInput}
          onFocus={() => state.suggestions.length > 0 && state.setShowSuggestions(true)}
          onAddKeyword={state.addKeyword}
        />
      )}

      {state.caps.hasAutoSuggestions && state.canEdit && !state.loading && (
        <MetadataKeywordSuggestions
          appSlug={appSlug}
          trackedKeywords={new Set(state.keywords.map((k: any) => k.keyword.toLowerCase()))}
          onKeywordAdded={(keywordId, scraperEnqueued) => {
            if (scraperEnqueued && keywordId) {
              state.setPendingKeywordIds((prev) => new Set(prev).add(keywordId));
            }
            state.loadKeywords(state.appSlugsParam, true);
            state.refreshUser();
          }}
          prominent={state.keywords.length === 0}
        />
      )}

      {state.tags.length > 0 && (
        <KeywordTagFilter
          tags={state.tags}
          activeTags={state.activeTagFilter}
          onToggle={state.toggleTagFilter}
          onClearAll={() => state.setActiveTagFilter(new Set())}
        />
      )}

      {state.wordGroups.length > 0 && (
        <KeywordWordGroupFilter
          wordGroups={state.wordGroups}
          activeWords={state.activeWordFilters}
          onToggle={(word) =>
            state.setActiveWordFilters((prev) => {
              const next = new Set(prev);
              if (next.has(word)) next.delete(word);
              else next.add(word);
              return next;
            })
          }
          onClear={() => state.setActiveWordFilters(new Set())}
        />
      )}

      {state.loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : state.keywords.length === 0 ? (
        !state.canEdit ? (
          <p className="text-muted-foreground text-center py-8">
            No keywords added yet.
          </p>
        ) : null
      ) : (
        <KeywordsTable
          platform={state.platform}
          sortedKeywords={state.sortedKeywords}
          selectedApps={state.selectedApps}
          pendingKeywordIds={state.pendingKeywordIds}
          resolvedKeywordIds={state.resolvedKeywordIds}
          opportunityData={state.opportunityData}
          opportunityLoading={state.opportunityLoading}
          showScoreDetails={state.showScoreDetails}
          sortBySlug={state.sortBySlug}
          sortDirection={state.sortDirection}
          tags={state.tags}
          canEdit={state.canEdit}
          hasAutoSuggestions={state.caps.hasAutoSuggestions}
          onSort={state.handleSort}
          onToggleScoreDetails={() => state.setShowScoreDetails(v => !v)}
          onSetConfirmRemove={state.setConfirmRemove}
          onSetSuggestionsKeyword={state.setSuggestionsKeyword}
          onAssignTag={state.assignTag}
          onUnassignTag={state.unassignTag}
          onCreateTag={state.createTag}
          onDeleteTag={state.deleteTag}
          onUpdateTag={state.updateTag}
        />
      )}

      <ConfirmModal
        open={!!state.confirmRemove}
        title="Remove Keyword"
        description={`Are you sure you want to remove "${state.confirmRemove?.keyword}" from this app's keywords?`}
        onConfirm={() => {
          if (state.confirmRemove) {
            state.removeKeyword(state.confirmRemove.keywordId, state.confirmRemove.keyword);
            state.setConfirmRemove(null);
          }
        }}
        onCancel={() => state.setConfirmRemove(null)}
      />

      {state.suggestionsKeyword && (
        <KeywordSuggestionsModal
          keywordSlug={state.suggestionsKeyword.slug}
          keyword={state.suggestionsKeyword.keyword}
          appSlug={appSlug}
          open={!!state.suggestionsKeyword}
          onClose={() => state.setSuggestionsKeyword(null)}
          onKeywordAdded={(keywordId, scraperEnqueued) => {
            if (scraperEnqueued && keywordId) {
              state.setPendingKeywordIds((prev) => new Set(prev).add(keywordId));
            }
            state.loadKeywords(state.appSlugsParam, true);
            state.refreshUser();
          }}
        />
      )}
    </div>
  );
}
