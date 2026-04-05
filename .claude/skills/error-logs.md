---
name: error-logs
description: Collect error logs from all GCP VMs, deduplicate, and create Linear tasks for unique errors
user-invocable: true
---

# GCP Error Log Scanner

Collect error logs from all 4 GCP VMs, identify unique error patterns, and create Linear tasks for new issues.

## Steps

1. **Collect error logs from all VMs via SSH/IAP:**

   ```bash
   # VM1: API (direct SSH)
   ssh -i ~/.ssh/appranks-gcp deploy@34.62.80.10 "sudo docker logs appranks-api-1 2>&1 | grep -E '\"level\":(50|\"error\"|\"fatal\")' | tail -50"

   # VM2: Scraper (IAP tunnel)
   gcloud compute ssh deploy@appranks-scraper --zone=europe-west1-b --tunnel-through-iap --project=appranks-web-app --quiet --command="sudo docker logs appranks-worker-1 2>&1 | grep -i 'error\|ERR\|fail\|FATAL' | tail -50"

   # VM3: Email workers (IAP tunnel)
   gcloud compute ssh deploy@appranks-email --zone=europe-west1-b --tunnel-through-iap --project=appranks-web-app --quiet --command="
     for c in appranks-worker-email-instant-1 appranks-worker-email-bulk-1 appranks-worker-notifications-1 appranks-redis-1; do
       echo '--- '\$c' ---'
       sudo docker logs \$c 2>&1 | grep -i 'error\|ERR\|fail\|FATAL' | tail -20
     done
   "

   # VM4: AI (IAP tunnel)
   gcloud compute ssh deploy@appranks-ai --zone=europe-west1-b --tunnel-through-iap --project=appranks-web-app --quiet --command="sudo docker logs appranks-alloy-1 2>&1 | grep -i 'error\|ERR\|fail\|FATAL' | tail -20"
   ```

2. **Deduplicate errors** by analyzing the collected logs:
   - Group errors by unique error message/pattern (ignore timestamps, request IDs, PIDs)
   - Count occurrences of each unique error
   - Identify which VM and container each error comes from
   - Note frequency (constant crash loop vs occasional)

3. **Check existing Linear tasks** to avoid duplicates:
   - Fetch open tasks with `gcp-error-logs` label from Linear
   - Compare new unique errors against existing task titles
   - Only create tasks for genuinely new error patterns

   ```bash
   # Fetch existing error-log tasks
   curl -s -X POST https://api.linear.app/graphql \
     -H "Content-Type: application/json" \
     -H "Authorization: $LINEAR_API_KEY" \
     -d '{"query": "query { issues(filter: { team: { key: { eq: \"PLA\" } }, labels: { name: { eq: \"gcp-error-logs\" } }, state: { type: { nin: [\"canceled\", \"completed\"] } } }) { nodes { identifier title } } }"}' \
     | jq -r '.data.issues.nodes[] | "\(.identifier): \(.title)"'
   ```

4. **Create Linear tasks** for each new unique error:
   - **Team:** PLA (`13127a86-8941-4c00-9031-9efb4a4fb91b`)
   - **Project:** Shopify App Tracker (`ee05a847-f284-4134-974f-6f3cfc7cec7a`)
   - **Labels:** `gcp-error-logs` (`a1197d29-e9d2-43d1-8574-5a4d1d9c6463`) + `auto-generated` (`25dbb951-787e-4845-9dba-984d57a57fae`)
   - **Priority:** 1 (Urgent) for crash loops, 2 (High) for frequent errors, 3 (Medium) for occasional, 4 (Low) for warnings
   - **Description format:**
     ```
     ## Problem
     [Error message and context]

     **VM:** [VM name]
     **Container:** [container name]
     **Frequency:** [count and pattern]
     **First seen:** [timestamp]

     ## Log Sample
     ```
     [2-3 representative log lines]
     ```

     ## Root Cause (likely)
     [Analysis based on error type]

     ## Solution Options
     [Suggested fixes]
     ```

5. **Report summary** to user:
   - Total errors collected
   - Unique error patterns found
   - New tasks created (with Linear links)
   - Existing tasks that match (already tracked)
