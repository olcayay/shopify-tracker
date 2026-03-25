#!/usr/bin/env bash
#
# Live Smoke Test for all platform scrapers
# Usage:
#   ./scripts/smoke-test.sh                        # test all platforms
#   ./scripts/smoke-test.sh --platform shopify      # test one platform
#   ./scripts/smoke-test.sh --skip-browser          # skip browser-dependent platforms
#   ./scripts/smoke-test.sh --timeout 90            # override default timeout (seconds)
#
set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
SELECTED_PLATFORM=""
SKIP_BROWSER=false
TIMEOUT_HTTP=60
TIMEOUT_BROWSER=120
SCRAPER_DIR="apps/scraper"
CLI="npx tsx src/cli.ts"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Counters ─────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0
RESULTS=()

# ── Parse flags ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      SELECTED_PLATFORM="$2"; shift 2 ;;
    --skip-browser)
      SKIP_BROWSER=true; shift ;;
    --timeout)
      TIMEOUT_HTTP="$2"; TIMEOUT_BROWSER=$(( $2 * 2 )); shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--platform <name>] [--skip-browser] [--timeout <seconds>]"
      echo ""
      echo "Platforms: shopify salesforce canva wix wordpress google_workspace atlassian zoom zoho zendesk hubspot"
      echo ""
      echo "Options:"
      echo "  --platform <name>   Test a single platform"
      echo "  --skip-browser      Skip platforms that need Playwright (salesforce, canva, google_workspace, zoho, zendesk)"
      echo "  --timeout <secs>    Override base timeout (default: 60s HTTP, 120s browser)"
      exit 0 ;;
    *)
      echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────

run_check() {
  local platform="$1"
  local check_name="$2"
  local timeout="$3"
  shift 3
  local cmd="$*"

  printf "  %-12s %-14s ... " "$platform" "$check_name"

  local start_time=$SECONDS
  local output
  local exit_code

  # Run from scraper directory with timeout
  output=$(cd "$SCRAPER_DIR" && timeout "$timeout" $cmd 2>&1) && exit_code=0 || exit_code=$?
  local elapsed=$(( SECONDS - start_time ))

  if [[ $exit_code -eq 0 ]]; then
    printf "${GREEN}PASS${RESET} (%ds)\n" "$elapsed"
    PASS=$((PASS + 1))
    RESULTS+=("PASS|$platform|$check_name|${elapsed}s")
  elif [[ $exit_code -eq 124 ]]; then
    printf "${RED}TIMEOUT${RESET} (>${timeout}s)\n"
    FAIL=$((FAIL + 1))
    RESULTS+=("TIMEOUT|$platform|$check_name|>${timeout}s")
  else
    printf "${RED}FAIL${RESET} (exit=$exit_code, %ds)\n" "$elapsed"
    # Show last 3 lines of output for debugging
    if [[ -n "$output" ]]; then
      echo "$output" | tail -3 | sed 's/^/    /'
    fi
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL|$platform|$check_name|${elapsed}s")
  fi
}

skip_check() {
  local platform="$1"
  local check_name="$2"
  local reason="$3"

  printf "  %-12s %-14s ... ${YELLOW}SKIP${RESET} (%s)\n" "$platform" "$check_name" "$reason"
  SKIP=$((SKIP + 1))
  RESULTS+=("SKIP|$platform|$check_name|$reason")
}

print_summary() {
  local total=$((PASS + FAIL + SKIP))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "${BOLD}SUMMARY${RESET}\n"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  %-10s %-16s %-10s %s\n" "STATUS" "PLATFORM" "CHECK" "TIME"
  echo "  ──────────────────────────────────────────────────────────────"
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status platform check time <<< "$result"
    local color="$RESET"
    case "$status" in
      PASS)    color="$GREEN" ;;
      FAIL|TIMEOUT) color="$RED" ;;
      SKIP)    color="$YELLOW" ;;
    esac
    printf "  ${color}%-10s${RESET} %-16s %-10s %s\n" "$status" "$platform" "$check" "$time"
  done
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  ${GREEN}PASS: $PASS${RESET}  ${RED}FAIL: $FAIL${RESET}  ${YELLOW}SKIP: $SKIP${RESET}  TOTAL: $total\n"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ── Platform Test Functions ──────────────────────────────────────────────────

test_shopify() {
  local t=$TIMEOUT_HTTP
  echo -e "\n${BLUE}${BOLD}▸ shopify${RESET} (HTTP only)"
  run_check shopify categories  "$t" $CLI --platform shopify categories finding-products
  run_check shopify app         "$t" $CLI --platform shopify app trendsi
  run_check shopify keyword     "$t" $CLI --platform shopify keyword "email marketing"
  run_check shopify reviews     "$t" $CLI --platform shopify reviews trendsi
  run_check shopify featured    "$t" $CLI --platform shopify featured
}

test_salesforce() {
  local t=$TIMEOUT_BROWSER
  if $SKIP_BROWSER; then skip_check salesforce all "browser skipped"; return; fi
  echo -e "\n${BLUE}${BOLD}▸ salesforce${RESET} (browser)"
  run_check salesforce categories "$t" $CLI --platform salesforce categories sales
  run_check salesforce app        "$t" $CLI --platform salesforce app a0N4V00000JTeWyUAL
  run_check salesforce keyword    "$t" $CLI --platform salesforce keyword "document generation"
  run_check salesforce reviews    "$t" $CLI --platform salesforce reviews a0N4V00000JTeWyUAL
}

test_canva() {
  local t=$TIMEOUT_BROWSER
  if $SKIP_BROWSER; then skip_check canva all "browser skipped"; return; fi
  echo -e "\n${BLUE}${BOLD}▸ canva${RESET} (browser)"
  run_check canva categories "$t" $CLI --platform canva categories ai-images
  run_check canva app        "$t" $CLI --platform canva app "AAE0b3zmS48--blur"
  run_check canva keyword    "$t" $CLI --platform canva keyword "image generator"
  run_check canva featured   "$t" $CLI --platform canva featured
}

test_wix() {
  local t=$TIMEOUT_HTTP
  echo -e "\n${BLUE}${BOLD}▸ wix${RESET} (HTTP only)"
  run_check wix categories "$t" $CLI --platform wix categories marketing
  run_check wix app        "$t" $CLI --platform wix app wix-forms
  run_check wix keyword    "$t" $CLI --platform wix keyword "form builder"
  run_check wix reviews    "$t" $CLI --platform wix reviews wix-forms
}

test_wordpress() {
  local t=$TIMEOUT_HTTP
  echo -e "\n${BLUE}${BOLD}▸ wordpress${RESET} (HTTP only)"
  run_check wordpress categories "$t" $CLI --platform wordpress categories contact-form
  run_check wordpress app        "$t" $CLI --platform wordpress app contact-form-7
  run_check wordpress keyword    "$t" $CLI --platform wordpress keyword "contact form"
  run_check wordpress reviews    "$t" $CLI --platform wordpress reviews contact-form-7
}

test_google_workspace() {
  local t=$TIMEOUT_BROWSER
  if $SKIP_BROWSER; then skip_check google_workspace all "browser skipped"; return; fi
  echo -e "\n${BLUE}${BOLD}▸ google_workspace${RESET} (browser)"
  run_check google_workspace categories "$t" $CLI --platform google_workspace categories business-tools
  run_check google_workspace app        "$t" $CLI --platform google_workspace app "able_poll--921058472860"
  run_check google_workspace keyword    "$t" $CLI --platform google_workspace keyword "project management"
  run_check google_workspace reviews    "$t" $CLI --platform google_workspace reviews "able_poll--921058472860"
}

test_atlassian() {
  local t=$TIMEOUT_HTTP
  echo -e "\n${BLUE}${BOLD}▸ atlassian${RESET} (HTTP only)"
  run_check atlassian categories "$t" $CLI --platform atlassian categories project-management
  run_check atlassian app        "$t" $CLI --platform atlassian app com.onresolve.jira.groovy.groovyrunner
  run_check atlassian keyword    "$t" $CLI --platform atlassian keyword "time tracking"
  run_check atlassian reviews    "$t" $CLI --platform atlassian reviews com.onresolve.jira.groovy.groovyrunner
  run_check atlassian featured   "$t" $CLI --platform atlassian featured
}

test_zoom() {
  local t=$TIMEOUT_HTTP
  echo -e "\n${BLUE}${BOLD}▸ zoom${RESET} (HTTP only)"
  run_check zoom categories "$t" $CLI --platform zoom categories crm
  run_check zoom keyword    "$t" $CLI --platform zoom keyword "calendar"
  run_check zoom featured   "$t" $CLI --platform zoom featured
}

test_zoho() {
  local t=$TIMEOUT_BROWSER
  if $SKIP_BROWSER; then skip_check zoho all "browser skipped"; return; fi
  echo -e "\n${BLUE}${BOLD}▸ zoho${RESET} (browser)"
  run_check zoho categories "$t" $CLI --platform zoho categories desk
  run_check zoho app        "$t" $CLI --platform zoho app "crm--360-sms-for-zoho-crm"
  run_check zoho keyword    "$t" $CLI --platform zoho keyword "inventory"
}

test_zendesk() {
  local t=$TIMEOUT_BROWSER
  if $SKIP_BROWSER; then skip_check zendesk all "browser skipped"; return; fi
  echo -e "\n${BLUE}${BOLD}▸ zendesk${RESET} (browser)"
  run_check zendesk categories "$t" $CLI --platform zendesk categories ai-and-bots
  run_check zendesk app        "$t" $CLI --platform zendesk app "972305--slack"
  run_check zendesk keyword    "$t" $CLI --platform zendesk keyword "automation"
  run_check zendesk reviews    "$t" $CLI --platform zendesk reviews "972305--slack"
  run_check zendesk featured   "$t" $CLI --platform zendesk featured
}

test_hubspot() {
  local t=$TIMEOUT_HTTP
  echo -e "\n${BLUE}${BOLD}▸ hubspot${RESET} (http/chirp)"
  run_check hubspot categories "$t" $CLI --platform hubspot categories sales
  run_check hubspot app        "$t" $CLI --platform hubspot app gmail
  run_check hubspot keyword    "$t" $CLI --platform hubspot keyword "email marketing"
  run_check hubspot reviews    "$t" $CLI --platform hubspot reviews gmail
  run_check hubspot featured   "$t" $CLI --platform hubspot featured
}

# ── Main ─────────────────────────────────────────────────────────────────────

ALL_PLATFORMS=(shopify salesforce canva wix wordpress google_workspace atlassian zoom zoho zendesk hubspot)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BOLD}  LIVE SCRAPER SMOKE TEST${RESET}"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Timeouts: HTTP=${TIMEOUT_HTTP}s  Browser=${TIMEOUT_BROWSER}s"
if [[ -n "$SELECTED_PLATFORM" ]]; then
  echo "  Platform: $SELECTED_PLATFORM"
fi
if $SKIP_BROWSER; then
  echo "  Skipping browser platforms"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -n "$SELECTED_PLATFORM" ]]; then
  # Validate platform name
  valid=false
  for p in "${ALL_PLATFORMS[@]}"; do
    if [[ "$p" == "$SELECTED_PLATFORM" ]]; then valid=true; break; fi
  done
  if ! $valid; then
    echo -e "${RED}Unknown platform: $SELECTED_PLATFORM${RESET}"
    echo "Valid platforms: ${ALL_PLATFORMS[*]}"
    exit 1
  fi
  "test_$SELECTED_PLATFORM"
else
  for p in "${ALL_PLATFORMS[@]}"; do
    "test_$p"
  done
fi

print_summary

# Exit with code 1 if any failures
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
