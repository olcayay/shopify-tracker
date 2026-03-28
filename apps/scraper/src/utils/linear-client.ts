import { createLogger } from "@appranks/shared";

const log = createLogger("linear");

const LINEAR_API_URL = "https://api.linear.app/graphql";
const TEAM_ID = "13127a86-8941-4c00-9031-9efb4a4fb91b";

let cachedLabelId: string | null = null;

function getApiKey(): string | null {
  return process.env.LINEAR_API_KEY || null;
}

async function graphql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("LINEAR_API_KEY not set");

  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API ${res.status}: ${text}`);
  }

  const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data as T;
}

/**
 * Find or create the "scraping-error" label on the team.
 * Caches the label ID in memory for subsequent calls.
 */
export async function ensureScrapingErrorLabel(): Promise<string | null> {
  if (cachedLabelId) return cachedLabelId;
  if (!getApiKey()) return null;

  try {
    // Search for existing label
    const data = await graphql<{
      team: { labels: { nodes: Array<{ id: string; name: string }> } };
    }>(
      `query($teamId: String!) {
        team(id: $teamId) {
          labels(filter: { name: { eq: "scraping-error" } }) {
            nodes { id name }
          }
        }
      }`,
      { teamId: TEAM_ID }
    );

    const existing = data.team.labels.nodes[0];
    if (existing) {
      cachedLabelId = existing.id;
      return cachedLabelId;
    }

    // Create the label
    const createData = await graphql<{
      issueLabelCreate: { success: boolean; issueLabel: { id: string } };
    }>(
      `mutation($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel { id }
        }
      }`,
      {
        input: {
          name: "scraping-error",
          color: "#E5484D",
          teamId: TEAM_ID,
        },
      }
    );

    if (createData.issueLabelCreate.success) {
      cachedLabelId = createData.issueLabelCreate.issueLabel.id;
      log.info("created scraping-error label", { id: cachedLabelId });
    }

    return cachedLabelId;
  } catch (err) {
    log.error("failed to ensure scraping-error label", { error: String(err) });
    return null;
  }
}

export interface CreateIssueParams {
  title: string;
  description: string;
  labelIds: string[];
  priority: number;
}

export interface CreateIssueResult {
  id: string;
  identifier: string;
  url: string;
}

const PROJECT_ID = "ee05a847-f284-4134-974f-6f3cfc7cec7a";
const AUTO_GENERATED_LABEL_ID = "25dbb951-787e-4845-9dba-984d57a57fae";

/**
 * Create a Linear issue with the given parameters.
 * Returns issue details or null if creation failed.
 */
export async function createLinearIssue(params: CreateIssueParams): Promise<CreateIssueResult | null> {
  if (!getApiKey()) return null;

  try {
    const data = await graphql<{
      issueCreate: {
        success: boolean;
        issue: { id: string; identifier: string; url: string };
      };
    }>(
      `mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }`,
      {
        input: {
          title: params.title,
          description: params.description,
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          labelIds: [AUTO_GENERATED_LABEL_ID, ...params.labelIds],
          priority: params.priority,
        },
      }
    );

    if (data.issueCreate.success) {
      const issue = data.issueCreate.issue;
      log.info("created Linear issue", { identifier: issue.identifier, url: issue.url });
      return issue;
    }

    return null;
  } catch (err) {
    log.error("failed to create Linear issue", { error: String(err) });
    return null;
  }
}

// Export for testing
export { TEAM_ID, PROJECT_ID, AUTO_GENERATED_LABEL_ID };
