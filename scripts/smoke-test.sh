#!/usr/bin/env bash
#
# Parallel Live Smoke Test for all platform scrapers
# Usage:
#   ./scripts/smoke-test.sh                                  # test all platforms (parallel + live table)
#   ./scripts/smoke-test.sh --platform shopify                # test one platform, all checks
#   ./scripts/smoke-test.sh --check categories                # all platforms, one check
#   ./scripts/smoke-test.sh --platform shopify --check app    # single cell
#   ./scripts/smoke-test.sh --check categories,app            # all platforms, two checks
#   ./scripts/smoke-test.sh --skip-browser                    # skip browser-dependent platforms
#   ./scripts/smoke-test.sh --timeout 90                      # override default timeout (seconds)
#   ./scripts/smoke-test.sh --jobs 4                          # limit concurrent checks
#   ./scripts/smoke-test.sh --no-live                         # CI-friendly plain output (no ANSI refresh)
#   ./scripts/smoke-test.sh --compare                         # run both primary AND fallback, show side-by-side
#
set -uo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
SELECTED_PLATFORM=""
SELECTED_CHECKS=""
SKIP_BROWSER=false
FORCE_FALLBACK=false
COMPARE_MODE=false
TIMEOUT_HTTP=60
TIMEOUT_BROWSER=120
MAX_JOBS=0  # 0 = unlimited
NO_LIVE=false
SCRAPER_DIR="apps/scraper"
CLI="npx tsx src/cli.ts"

# ── ANSI Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Parse flags ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      SELECTED_PLATFORM="$2"; shift 2 ;;
    --check)
      SELECTED_CHECKS="$2"; shift 2 ;;
    --skip-browser)
      SKIP_BROWSER=true; shift ;;
    --timeout)
      TIMEOUT_HTTP="$2"; TIMEOUT_BROWSER=$(( $2 * 2 )); shift 2 ;;
    --jobs)
      MAX_JOBS="$2"; shift 2 ;;
    --no-live)
      NO_LIVE=true; shift ;;
    --fallback)
      FORCE_FALLBACK=true; shift ;;
    --compare)
      COMPARE_MODE=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--platform <name>] [--check <checks>] [--skip-browser] [--fallback] [--compare] [--timeout <seconds>] [--jobs N] [--no-live]"
      echo ""
      echo "Platforms: shopify salesforce canva wix wordpress google_workspace atlassian zoom zoho zendesk hubspot"
      echo "Checks:    categories app keyword reviews featured"
      echo ""
      echo "Options:"
      echo "  --platform <name>   Test a single platform (row filter)"
      echo "  --check <checks>    Test specific check types, comma-separated (column filter)"
      echo "                      Examples: --check categories  --check categories,app"
      echo "  --skip-browser      Skip platforms that need Playwright (salesforce, canva, google_workspace, zoho, zendesk)"
      echo "  --fallback          Force fallback/secondary scraping methods (sets FORCE_FALLBACK=true)"
      echo "  --compare           Run both PRIMARY and FALLBACK, show results side by side"
      echo "  --timeout <secs>    Override base timeout (default: 60s HTTP, 120s browser)"
      echo "  --jobs N            Limit concurrent checks (default: unlimited)"
      echo "  --no-live           CI-friendly plain output (no ANSI table refresh)"
      echo ""
      echo "Examples:"
      echo "  $0 --platform shopify                  # one platform, all checks"
      echo "  $0 --check categories                  # all platforms, one check"
      echo "  $0 --platform shopify --check categories  # single cell"
      echo "  $0 --check categories,app              # all platforms, two checks"
      exit 0 ;;
    *)
      echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Auto-detect: if not a terminal, disable live mode
if [[ ! -t 1 ]]; then
  NO_LIVE=true
fi

# ── Temp directory ───────────────────────────────────────────────────────────
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/smoke-XXXXX")

CURSOR_HIDDEN=false

cleanup() {
  local pids
  pids=$(jobs -p 2>/dev/null) || true
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    wait $pids 2>/dev/null || true
  fi
  if $CURSOR_HIDDEN; then
    printf "\033[?25h" 2>/dev/null || true
    CURSOR_HIDDEN=false
  fi
  rm -rf "$WORK_DIR"
}
trap 'cleanup' EXIT
trap 'cleanup; exit 130' INT TERM

# ── Platform check matrix ────────────────────────────────────────────────────
# Each platform defined as: platform|timeout_type|check1:arg check2:arg ...
# timeout_type: http or browser. Args use + for spaces.
# Checks not listed = N/A for that platform.
ALL_PLATFORMS=(shopify salesforce canva wix wordpress google_workspace atlassian zoom zoho zendesk hubspot)
ALL_CHECKS=(categories app keyword reviews featured)

# Platform definitions — index matches ALL_PLATFORMS
PLATFORM_TYPE=(http browser browser http http browser http http browser browser http)
PLATFORM_CHECKS=(
  "categories:finding-products app:trendsi keyword:email+marketing reviews:formful featured:"
  "categories:sales app:a0N4V00000JTeWyUAL keyword:document+generation reviews:a0N4V00000JTeWyUAL"
  "categories:ai-images app:AAE0b3zmS48--blur keyword:image+generator featured:"
  "categories:marketing app:wix-forms keyword:form+builder reviews:wix-forms"
  "categories:contact-form app:contact-form-7 keyword:contact+form reviews:contact-form-7"
  "categories:business-tools app:able_poll--921058472860 keyword:project+management reviews:able_poll--921058472860"
  "categories:project-management app:com.onresolve.jira.groovy.groovyrunner keyword:time+tracking reviews:com.onresolve.jira.groovy.groovyrunner featured:"
  "categories:crm app:VG_p3Bb_TwWe_bgZmPUaXw keyword:calendar featured:"
  "categories:desk app:crm--360-sms-for-zoho-crm keyword:inventory"
  "categories:ai-and-bots app:972305--slack keyword:automation reviews:972305--slack featured:"
  "categories:sales+--pages+3 app:gmail keyword:email+marketing reviews:gmail featured:"
)

# ── Validate selected platform ───────────────────────────────────────────────
if [[ -n "$SELECTED_PLATFORM" ]]; then
  valid=false
  for p in "${ALL_PLATFORMS[@]}"; do
    if [[ "$p" == "$SELECTED_PLATFORM" ]]; then valid=true; break; fi
  done
  if ! $valid; then
    echo -e "${RED}Unknown platform: $SELECTED_PLATFORM${RESET}"
    echo "Valid platforms: ${ALL_PLATFORMS[*]}"
    exit 1
  fi
fi

# ── Validate selected checks & build ACTIVE_CHECKS ─────────────────────────
ACTIVE_CHECKS=()
if [[ -n "$SELECTED_CHECKS" ]]; then
  IFS=',' read -ra _sel_checks <<< "$SELECTED_CHECKS"
  for sc in "${_sel_checks[@]}"; do
    valid=false
    for c in "${ALL_CHECKS[@]}"; do
      if [[ "$c" == "$sc" ]]; then valid=true; break; fi
    done
    if ! $valid; then
      echo -e "${RED}Unknown check: $sc${RESET}"
      echo "Valid checks: ${ALL_CHECKS[*]}"
      exit 1
    fi
    ACTIVE_CHECKS+=("$sc")
  done
else
  ACTIVE_CHECKS=("${ALL_CHECKS[@]}")
fi

# ── Helpers: get platform index ──────────────────────────────────────────────
platform_index() {
  local target="$1" i=0
  for p in "${ALL_PLATFORMS[@]}"; do
    if [[ "$p" == "$target" ]]; then echo "$i"; return; fi
    i=$((i + 1))
  done
  echo "-1"
}

# Get CLI arg for a platform+check (empty string if no arg, "__NA__" if check doesn't exist)
get_check_arg() {
  local platform="$1" check="$2"
  local idx
  idx=$(platform_index "$platform")
  local checks_str="${PLATFORM_CHECKS[$idx]}"

  for entry in $checks_str; do
    local c="${entry%%:*}"
    local a="${entry#*:}"
    if [[ "$c" == "$check" ]]; then
      if [[ "$c" == "$a" ]]; then
        echo ""
      else
        echo "$a"
      fi
      return
    fi
  done
  echo "__NA__"
}

get_timeout() {
  local platform="$1"
  local idx
  idx=$(platform_index "$platform")
  if [[ "${PLATFORM_TYPE[$idx]}" == "browser" ]]; then
    echo "$TIMEOUT_BROWSER"
  else
    echo "$TIMEOUT_HTTP"
  fi
}

is_browser_platform() {
  local platform="$1"
  local idx
  idx=$(platform_index "$platform")
  [[ "${PLATFORM_TYPE[$idx]}" == "browser" ]]
}

# ── Determine active platforms ───────────────────────────────────────────────
ACTIVE_PLATFORMS=()
for p in "${ALL_PLATFORMS[@]}"; do
  if [[ -n "$SELECTED_PLATFORM" && "$p" != "$SELECTED_PLATFORM" ]]; then
    continue
  fi
  ACTIVE_PLATFORMS+=("$p")
done

# ── Initialize status files + build job list ─────────────────────────────────
# Status stored in files: $WORK_DIR/<platform>-<check>.status
# Values: PENDING, RUNNING, PASS, FAIL, TIMEOUT, SKIP, NA
JOB_LIST=()

for platform in "${ACTIVE_PLATFORMS[@]}"; do
  for check in "${ACTIVE_CHECKS[@]}"; do
    local_arg=$(get_check_arg "$platform" "$check")
    if [[ "$local_arg" == "__NA__" ]]; then
      echo "NA" > "$WORK_DIR/${platform}-${check}.status"
    elif $SKIP_BROWSER && is_browser_platform "$platform"; then
      echo "SKIP" > "$WORK_DIR/${platform}-${check}.status"
    else
      echo "PENDING" > "$WORK_DIR/${platform}-${check}.status"
      JOB_LIST+=("${platform}|${check}")
    fi
  done
done

# ── Start time ───────────────────────────────────────────────────────────────
START_EPOCH=$(date +%s)

# ── Get status for a cell ────────────────────────────────────────────────────
get_status() {
  cat "$WORK_DIR/${1}-${2}.status" 2>/dev/null || echo "PENDING"
}

get_duration() {
  cat "$WORK_DIR/${1}-${2}.duration" 2>/dev/null || echo "0"
}

# ── Background check runner ─────────────────────────────────────────────────
run_check_bg() {
  local platform="$1" check="$2"
  local arg
  arg=$(get_check_arg "$platform" "$check")
  local tout
  tout=$(get_timeout "$platform")
  local cli_arg="${arg//+/ }"

  # .start is written by launch_all_jobs before backgrounding

  local cmd
  if [[ -n "$cli_arg" ]]; then
    cmd="$CLI --platform $platform $check $cli_arg"
  else
    cmd="$CLI --platform $platform $check"
  fi

  local output exit_code
  local env_prefix=""
  if $FORCE_FALLBACK; then
    env_prefix="FORCE_FALLBACK=true "
  fi
  output=$(cd "$SCRAPER_DIR" && timeout "$tout" env ${env_prefix} $cmd 2>&1) && exit_code=0 || exit_code=$?

  local end_epoch start_epoch elapsed
  end_epoch=$(date +%s)
  start_epoch=$(cat "$WORK_DIR/${platform}-${check}.start")
  elapsed=$((end_epoch - start_epoch))

  echo "$output" > "$WORK_DIR/${platform}-${check}.output"
  echo "$elapsed" > "$WORK_DIR/${platform}-${check}.duration"
  echo "$exit_code" > "$WORK_DIR/${platform}-${check}.exitcode"

  if [[ $exit_code -eq 0 ]]; then
    echo "PASS" > "$WORK_DIR/${platform}-${check}.status"
  elif [[ $exit_code -eq 124 ]]; then
    echo "TIMEOUT" > "$WORK_DIR/${platform}-${check}.status"
  else
    echo "FAIL" > "$WORK_DIR/${platform}-${check}.status"
  fi
}

# ── Count helpers ────────────────────────────────────────────────────────────
count_by_status() {
  local target="$1" count=0
  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      if [[ "$(get_status "$platform" "$check")" == "$target" ]]; then
        count=$((count + 1))
      fi
    done
  done
  echo "$count"
}

count_failures() {
  local count=0
  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      local s
      s=$(get_status "$platform" "$check")
      if [[ "$s" == "FAIL" || "$s" == "TIMEOUT" ]]; then
        count=$((count + 1))
      fi
    done
  done
  echo "$count"
}

all_done() {
  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      local s
      s=$(get_status "$platform" "$check")
      if [[ "$s" == "RUNNING" || "$s" == "PENDING" ]]; then
        return 1
      fi
    done
  done
  return 0
}

count_running() {
  local count=0
  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      if [[ "$(get_status "$platform" "$check")" == "RUNNING" ]]; then
        count=$((count + 1))
      fi
    done
  done
  echo "$count"
}

# ── Render helpers ───────────────────────────────────────────────────────────
COL_PLATFORM=18
COL_CHECK=12
TABLE_WIDTH=$(( 2 + COL_PLATFORM + ${#ACTIVE_CHECKS[@]} * COL_CHECK ))
TABLE_LINES=0

render_cell() {
  local status="$1" platform="$2" check="$3"

  case "$status" in
    PASS)
      local dur
      dur=$(get_duration "$platform" "$check")
      printf "${GREEN}✓ %-$((COL_CHECK - 3))s${RESET}" "${dur}s"
      ;;
    FAIL|TIMEOUT)
      local dur
      dur=$(get_duration "$platform" "$check")
      printf "${RED}✗ %-$((COL_CHECK - 3))s${RESET}" "${dur}s"
      ;;
    RUNNING)
      local now elapsed=0
      now=$(date +%s)
      local start_file="$WORK_DIR/${platform}-${check}.start"
      if [[ -f "$start_file" ]]; then
        local start_ts
        start_ts=$(cat "$start_file" 2>/dev/null || echo "$now")
        elapsed=$((now - start_ts))
      fi
      printf "${CYAN}⟳ %-$((COL_CHECK - 3))s${RESET}" "${elapsed}s"
      ;;
    PENDING)
      printf "${DIM}· · ·%-$((COL_CHECK - 6))s${RESET}" ""
      ;;
    NA)
      printf "${DIM}─ %-$((COL_CHECK - 3))s${RESET}" ""
      ;;
    SKIP)
      printf "${YELLOW}⊘ %-$((COL_CHECK - 3))s${RESET}" ""
      ;;
  esac
}

render_table() {
  local now elapsed pass_n fail_n skip_n pending_n running_n na_n
  now=$(date +%s)
  elapsed=$((now - START_EPOCH))
  pass_n=$(count_by_status PASS)
  fail_n=$(count_failures)
  skip_n=$(count_by_status SKIP)
  pending_n=$(count_by_status PENDING)
  running_n=$(count_running)
  na_n=$(count_by_status NA)

  local lines=0
  local ruler
  ruler=$(printf '━%.0s' $(seq 1 $TABLE_WIDTH))

  echo "$ruler"; lines=$((lines + 1))

  local title="LIVE SCRAPER SMOKE TEST"
  if $FORCE_FALLBACK; then title="LIVE SCRAPER SMOKE TEST (FALLBACK MODE)"; fi
  local title_pad=$((TABLE_WIDTH - ${#title} - 18))
  if [[ $title_pad -lt 1 ]]; then title_pad=1; fi
  printf "  ${BOLD}${title}${RESET}%*s%s\n" \
    "$title_pad" "" "$(date '+%Y-%m-%d %H:%M:%S')"
  lines=$((lines + 1))

  local stats_line="  Timeouts: HTTP=${TIMEOUT_HTTP}s  Browser=${TIMEOUT_BROWSER}s"
  printf "%s" "$stats_line"
  local stats_pad=$((TABLE_WIDTH - ${#stats_line} - 42))
  if [[ $stats_pad -lt 1 ]]; then stats_pad=1; fi
  printf "%*s" "$stats_pad" ""
  printf "${CYAN}⟳ %-3d${RESET} ${DIM}· %-3d${RESET} ${GREEN}✓ %-3d${RESET} ${RED}✗ %-3d${RESET} ${DIM}─ %-3d${RESET} ${YELLOW}⊘ %-3d${RESET}\n" \
    "$running_n" "$pending_n" "$pass_n" "$fail_n" "$na_n" "$skip_n"
  lines=$((lines + 1))

  echo "$ruler"; lines=$((lines + 1))

  printf "  ${BOLD}%-${COL_PLATFORM}s${RESET}" "PLATFORM"
  for check in "${ACTIVE_CHECKS[@]}"; do
    printf "${BOLD}%-${COL_CHECK}s${RESET}" "$check"
  done
  echo ""; lines=$((lines + 1))

  printf "  "
  printf '─%.0s' $(seq 1 $((TABLE_WIDTH - 4)))
  echo ""; lines=$((lines + 1))

  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    printf "  %-${COL_PLATFORM}s" "$platform"
    for check in "${ACTIVE_CHECKS[@]}"; do
      local s
      s=$(get_status "$platform" "$check")
      render_cell "$s" "$platform" "$check"
    done
    echo ""; lines=$((lines + 1))
  done

  echo ""; lines=$((lines + 1))
  echo "$ruler"; lines=$((lines + 1))
  printf "  ${GREEN}✓ PASS: %-4d${RESET}${RED}✗ FAIL: %-4d${RESET}${YELLOW}⊘ SKIP: %-4d${RESET}Elapsed: %ds\n" \
    "$pass_n" "$fail_n" "$skip_n" "$elapsed"
  lines=$((lines + 1))
  echo "$ruler"; lines=$((lines + 1))

  TABLE_LINES=$lines
}

# ── Print failure details ────────────────────────────────────────────────────
print_failures() {
  local has_failures=false
  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      local s
      s=$(get_status "$platform" "$check")
      if [[ "$s" == "FAIL" || "$s" == "TIMEOUT" ]]; then
        has_failures=true
        break 2
      fi
    done
  done

  if ! $has_failures; then return; fi

  echo ""
  echo -e "  ${RED}${BOLD}FAILURES:${RESET}"
  printf "  "; printf '─%.0s' $(seq 1 74); echo ""

  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      local s
      s=$(get_status "$platform" "$check")
      if [[ "$s" == "FAIL" || "$s" == "TIMEOUT" ]]; then
        local dur exit_code
        dur=$(get_duration "$platform" "$check")
        exit_code=$(cat "$WORK_DIR/${platform}-${check}.exitcode" 2>/dev/null || echo "?")
        echo -e "  ${RED}✗${RESET} ${BOLD}${platform} / ${check}${RESET} (exit=${exit_code}, ${dur}s):"
        local output_file="$WORK_DIR/${platform}-${check}.output"
        if [[ -f "$output_file" ]]; then
          tail -5 "$output_file" | sed 's/^/    /'
        fi
        echo ""
      fi
    done
  done
}

# ── Launch jobs ──────────────────────────────────────────────────────────────
launch_all_jobs() {
  for job in "${JOB_LIST[@]}"; do
    IFS='|' read -r platform check <<< "$job"

    # Concurrency throttle
    if [[ $MAX_JOBS -gt 0 ]]; then
      while true; do
        local running
        running=$(count_running)
        if [[ $running -lt $MAX_JOBS ]]; then
          break
        fi
        sleep 0.2
      done
    fi

    echo "RUNNING" > "$WORK_DIR/${platform}-${check}.status"
    date +%s > "$WORK_DIR/${platform}-${check}.start"
    run_check_bg "$platform" "$check" &
  done
}

# ── No-live mode (CI) ───────────────────────────────────────────────────────
run_no_live() {
  local ruler
  ruler=$(printf '━%.0s' $(seq 1 $TABLE_WIDTH))
  echo ""
  echo "$ruler"
  local ci_title="LIVE SCRAPER SMOKE TEST"
  if $FORCE_FALLBACK; then ci_title="LIVE SCRAPER SMOKE TEST (FALLBACK MODE)"; fi
  echo -e "  ${BOLD}${ci_title}${RESET}  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  Timeouts: HTTP=${TIMEOUT_HTTP}s  Browser=${TIMEOUT_BROWSER}s"
  if [[ -n "$SELECTED_PLATFORM" ]]; then echo "  Platform: $SELECTED_PLATFORM"; fi
  if [[ -n "$SELECTED_CHECKS" ]]; then echo "  Checks: $SELECTED_CHECKS"; fi
  if $SKIP_BROWSER; then echo "  Skipping browser platforms"; fi
  if $FORCE_FALLBACK; then echo "  Fallback mode: ENABLED (testing secondary scraping methods)"; fi
  echo "$ruler"
  echo ""

  launch_all_jobs

  while ! all_done; do
    sleep 0.3
  done
  wait 2>/dev/null || true

  local pass_n=0 fail_n=0 skip_n=0
  for platform in "${ACTIVE_PLATFORMS[@]}"; do
    for check in "${ACTIVE_CHECKS[@]}"; do
      local s
      s=$(get_status "$platform" "$check")
      case "$s" in
        PASS)
          printf "  ${GREEN}PASS${RESET}    %-18s %-14s %ss\n" "$platform" "$check" "$(get_duration "$platform" "$check")"
          pass_n=$((pass_n + 1)) ;;
        FAIL|TIMEOUT)
          printf "  ${RED}%-7s${RESET} %-18s %-14s %ss\n" "$s" "$platform" "$check" "$(get_duration "$platform" "$check")"
          fail_n=$((fail_n + 1)) ;;
        SKIP)
          printf "  ${YELLOW}SKIP${RESET}    %-18s %-14s browser skipped\n" "$platform" "$check"
          skip_n=$((skip_n + 1)) ;;
      esac
    done
  done

  echo ""
  echo "$ruler"
  local total_elapsed=$(( $(date +%s) - START_EPOCH ))
  printf "  ${GREEN}PASS: $pass_n${RESET}  ${RED}FAIL: $fail_n${RESET}  ${YELLOW}SKIP: $skip_n${RESET}  Elapsed: ${total_elapsed}s\n"
  echo "$ruler"

  print_failures
  [[ $fail_n -gt 0 ]] && return 1 || return 0
}

# ── Live mode (interactive terminal) ────────────────────────────────────────
run_live() {
  printf "\033[?25l"  # Hide cursor
  CURSOR_HIDDEN=true

  echo ""
  launch_all_jobs

  render_table

  while true; do
    if all_done; then
      printf "\033[${TABLE_LINES}A"
      render_table
      break
    fi

    sleep 0.5
    printf "\033[${TABLE_LINES}A"
    render_table
  done

  wait 2>/dev/null || true
  printf "\033[?25h"  # Show cursor
  CURSOR_HIDDEN=false

  print_failures

  local fail_n
  fail_n=$(count_failures)
  [[ $fail_n -gt 0 ]] && return 1 || return 0
}

# ── Compare mode: run both primary and fallback ─────────────────────────
run_compare() {
  local script_path
  script_path="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  local extra_args=""
  if [[ -n "$SELECTED_PLATFORM" ]]; then extra_args="$extra_args --platform $SELECTED_PLATFORM"; fi
  if [[ -n "$SELECTED_CHECKS" ]]; then extra_args="$extra_args --check $SELECTED_CHECKS"; fi
  if $SKIP_BROWSER; then extra_args="$extra_args --skip-browser"; fi
  extra_args="$extra_args --timeout $TIMEOUT_HTTP"
  if [[ $MAX_JOBS -gt 0 ]]; then extra_args="$extra_args --jobs $MAX_JOBS"; fi

  local ruler
  ruler=$(printf '━%.0s' $(seq 1 80))
  echo ""
  echo "$ruler"
  echo -e "  ${BOLD}COMPARE MODE: PRIMARY vs FALLBACK${RESET}  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "$ruler"

  echo ""
  echo -e "  ${BOLD}${CYAN}▶ PHASE 1: PRIMARY (normal scraping)${RESET}"
  echo ""
  bash "$script_path" --no-live $extra_args
  local primary_exit=$?

  echo ""
  echo -e "  ${BOLD}${YELLOW}▶ PHASE 2: FALLBACK (secondary scraping)${RESET}"
  echo ""
  bash "$script_path" --no-live --fallback $extra_args
  local fallback_exit=$?

  echo ""
  echo "$ruler"
  echo -e "  ${BOLD}COMPARE SUMMARY${RESET}"
  echo "$ruler"

  if [[ $primary_exit -eq 0 ]]; then
    echo -e "  PRIMARY:  ${GREEN}ALL PASS${RESET}"
  else
    echo -e "  PRIMARY:  ${RED}HAS FAILURES${RESET} (exit $primary_exit)"
  fi

  if [[ $fallback_exit -eq 0 ]]; then
    echo -e "  FALLBACK: ${GREEN}ALL PASS${RESET}"
  else
    echo -e "  FALLBACK: ${RED}HAS FAILURES${RESET} (exit $fallback_exit)"
  fi

  echo "$ruler"
  echo ""

  if [[ $primary_exit -ne 0 || $fallback_exit -ne 0 ]]; then
    return 1
  fi
  return 0
}

# ── Main ─────────────────────────────────────────────────────────────────────
if $COMPARE_MODE; then
  run_compare
  exit $?
fi

if [[ ${#JOB_LIST[@]} -eq 0 ]]; then
  echo "No checks to run."
  if $SKIP_BROWSER; then
    echo "(All selected platforms require a browser; use without --skip-browser)"
  fi
  exit 0
fi

if $NO_LIVE; then
  run_no_live
else
  run_live
fi
