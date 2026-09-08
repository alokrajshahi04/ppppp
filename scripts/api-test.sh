#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Tolti AI · end-to-end API test suite
#  Usage:  ./scripts/api-test.sh [BASE_URL]
#  Default BASE_URL: http://localhost:3001
#  Requires: curl, jq
# ─────────────────────────────────────────────────────────────
set -uo pipefail

BASE="${1:-http://localhost:3001}"
PASS=0; FAIL=0; TOTAL=0
TOKEN=""
WS_ID=""

c_green='\033[32m'; c_red='\033[31m'; c_dim='\033[2m'; c_bold='\033[1m'; c_off='\033[0m'

check() { # name, expected, actual
    TOTAL=$((TOTAL+1))
    if [[ "$2" == "$3" ]]; then
        PASS=$((PASS+1)); printf "  ${c_green}✔${c_off} %s ${c_dim}(%s)${c_off}\n" "$1" "$2"
    else
        FAIL=$((FAIL+1)); printf "  ${c_red}✘${c_off} %s ${c_dim}expected=%s got=%s${c_off}\n" "$1" "$2" "$3"
    fi
}

req() { # method, path, [json-body], [extra curl args...]
    local method="$1" path="$2" body="${3:-}"
    shift 3 2>/dev/null || shift $#
    local ct=()
    if [[ -n "$body" ]]; then
        ct=(-H 'Content-Type: application/json')
        curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" \
            -H "Authorization: Bearer ${TOKEN:-}" \
            "${ct[@]}" -d "$body" "$@"
    else
        curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" \
            ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
            "$@"
    fi
}

code_of()  { tail -n1 <<<"$1"; }
body_of()  { sed '$d' <<<"$1"; }
expect_code() { check "$1" "$2" "$(code_of "$3")"; }

section() { printf "\n${c_bold}%s${c_off}\n" "── $1 ──────────────────────────────"; }

# ═════════════════════════════════════════════════════════════
section "0 · Health"
R=$(req GET /health)
expect_code "GET /health" 200 "$R"
check "health status=ok" "ok" "$(body_of "$R" | jq -r .status)"

# ═════════════════════════════════════════════════════════════
section "1 · Auth"
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}')
expect_code "login (admin)" 200 "$R"
TOKEN=$(body_of "$R" | jq -r .access_token)
check "access_token issued" "yes" "$([[ ${#TOKEN} -gt 40 ]] && echo yes || echo no)"

R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"WRONG"}')
expect_code "login rejects bad password" 401 "$R"

R=$(req GET /api/v1/auth/me)
expect_code "GET /me" 200 "$R"
check "me.email" "admin@tolti.ai" "$(body_of "$R" | jq -r .email)"

TOKEN=""
R=$(req GET /api/v1/auth/me)
expect_code "GET /me without token" 401 "$R"

R=$(req POST /api/v1/auth/login '{"email":"driver@tolti.ai","password":"admin"}')
expect_code "login (driver)" 200 "$R"
DRIVER_TOKEN=$(body_of "$R" | jq -r .access_token)

# ═════════════════════════════════════════════════════════════
section "2 · RBAC"
TOKEN="$DRIVER_TOKEN"
R=$(req GET /api/v1/audit)
expect_code "driver forbidden from /audit" 403 "$R"
R=$(req GET /api/v1/users)
check "driver sees only self" 1 "$(body_of "$R" | jq 'length')"

# ═════════════════════════════════════════════════════════════
section "3 · Workspaces"
TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req GET /api/v1/workspaces)
expect_code "list workspaces" 200 "$R"
# Use the seeded Default Workspace for everything — the suite must not
# litter the demo DB with extra workspaces (seed already members all roles).
WS2=$(body_of "$R" | jq -r '.[] | select(.slug=="default") | .id')
check "default workspace exists" "yes" "$([[ -n "$WS2" && "$WS2" != "null" ]] && echo yes || echo no)"

R=$(req GET "/api/v1/workspaces/$WS2/members")
expect_code "list members" 200 "$R"

R=$(req POST "/api/v1/workspaces/$WS2/members" "{\"user_id\":\"00000000-0000-0000-0000-000000000002\",\"role\":\"DRIVER\"}")
expect_code "add driver to workspace" 200 "$R"

R=$(req POST "/api/v1/workspaces/$WS2/members" "{\"user_id\":\"00000000-0000-0000-0000-000000000005\",\"role\":\"SECURITY_APPROVER\"}")
expect_code "add security approver to workspace" 200 "$R"

# ═════════════════════════════════════════════════════════════
section "4 · Tasks"
RUN_TAG="e2e-$(date +%s)"
R=$(req POST /api/v1/tasks "{\"workspace_id\":\"$WS2\",\"title\":\"$RUN_TAG pump anomaly\",\"description\":\"Investigate repeated bearing failures on line 7\",\"priority\":\"HIGH\"}")
expect_code "create task" 201 "$R"
TASK_ID=$(body_of "$R" | jq -r .id)

R=$(req GET "/api/v1/tasks/$TASK_ID")
expect_code "get task" 200 "$R"

R=$(req PATCH "/api/v1/tasks/$TASK_ID" '{"status":"IN_PROGRESS"}')
expect_code "update task status" 200 "$R"
check "status applied" "IN_PROGRESS" "$(body_of "$R" | jq -r .status)"

R=$(req GET "/api/v1/tasks?workspace_id=$WS2&q=$RUN_TAG")
check "search by unique tag finds 1" 1 "$(body_of "$R" | jq '.total')"

R=$(req POST "/api/v1/tasks/$TASK_ID/handoff" '{"to_user_id":"00000000-0000-0000-0000-000000000003","note":"reviewer to take over"}')
expect_code "handoff task" 200 "$R"

# ═════════════════════════════════════════════════════════════
section "4b · Room membership (invite-only shared rooms)"
# Dedicated task — section 4's handoff auto-grants membership, so the
# invite flow is proven on a fresh room.
R=$(req POST /api/v1/tasks "{\"workspace_id\":\"$WS2\",\"title\":\"$RUN_TAG invite room\",\"description\":\"membership flow\"}")
expect_code "create invite-flow room" 201 "$R"
MEM_TASK=$(body_of "$R" | jq -r .id)

RT=""
R=$(req POST /api/v1/auth/login '{"email":"reviewer@tolti.ai","password":"admin"}'); RT=$(body_of "$R" | jq -r .access_token)
R=$(curl -s -w '\n%{http_code}' "http://localhost:3001/api/v1/tasks?workspace_id=$WS2" -H "Authorization: Bearer $RT")
check "uninvited reviewer cannot see new shared room" 0 "$(body_of "$R" | jq "[.items[] | select(.id==\"$MEM_TASK\")] | length")"
TOKEN="$RT"
R=$(req GET "/api/v1/tasks/$MEM_TASK")
check "uninvited reviewer GET task → 404" 404 "$(code_of "$R")"

TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req GET "/api/v1/tasks/$MEM_TASK/members")
expect_code "driver lists room members" 200 "$R"
check "driver is implicit member" "true" "$(body_of "$R" | jq '[.[] | select(.is_driver)] | length > 0')"

R=$(req POST "/api/v1/tasks/$MEM_TASK/members" '{"user_id":"00000000-0000-0000-0000-000000000003"}')
expect_code "driver invites reviewer" 200 "$R"
R=$(req POST "/api/v1/tasks/$MEM_TASK/members" '{"user_id":"00000000-0000-0000-0000-000000000005"}')
expect_code "admin invites security approver" 200 "$R"

# Reviewer probes with their own token
TOKEN="$RT"
R=$(req GET "/api/v1/tasks/$MEM_TASK")
expect_code "invited reviewer now sees room" 200 "$R"
R=$(req POST "/api/v1/tasks/$MEM_TASK/messages" '{"content":"Invited reviewer checking in."}')
expect_code "invited reviewer can post" 200 "$R"
R=$(req POST "/api/v1/tasks/$MEM_TASK/members" '{"user_id":"00000000-0000-0000-0000-000000000004"}')
check "invitee cannot invite others" 403 "$(code_of "$R")"

TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req DELETE "/api/v1/tasks/$MEM_TASK/members/00000000-0000-0000-0000-000000000003")
expect_code "admin removes member" 200 "$R"
TOKEN="$RT"
R=$(req GET "/api/v1/tasks/$MEM_TASK")
check "removed reviewer loses room" 404 "$(code_of "$R")"
TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req POST "/api/v1/tasks/$MEM_TASK/members" '{"user_id":"00000000-0000-0000-0000-000000000003"}')
expect_code "admin re-invites reviewer" 200 "$R"

# ═════════════════════════════════════════════════════════════
section "5 · Messages"
R=$(req POST "/api/v1/tasks/$TASK_ID/messages" '{"content":"Bearing temp spiked to 92°C overnight."}')
expect_code "post message" 200 "$R"

R=$(req GET "/api/v1/tasks/$TASK_ID/messages")
expect_code "list messages" 200 "$R"
check "1 message stored" 1 "$(body_of "$R" | jq 'length')"

# ═════════════════════════════════════════════════════════════
section "6 · Evidence + MinIO"
printf 'Bearing assembly manual. Max operating temp 80C. Lubrication interval: 500h.\n' > /tmp/opencode/e2e-spec.txt
R=$(req POST "/api/v1/tasks/$TASK_ID/evidence" '{"kind":"TEXT","filename":"e2e-spec.txt","mime_type":"text/plain","byte_size":84}')
expect_code "presign evidence upload" 201 "$R"
EV_ID=$(body_of "$R" | jq -r .evidence.id)
UPLOAD_URL=$(body_of "$R" | jq -r .upload_url)

if [[ -n "$UPLOAD_URL" && "$UPLOAD_URL" != "null" ]]; then
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$UPLOAD_URL" -H 'Content-Type: text/plain' --data-binary @/tmp/opencode/e2e-spec.txt)
    check "direct PUT to MinIO presigned URL" 200 "$CODE"
fi

R=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/evidence/$EV_ID/upload-proxy" -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/opencode/e2e-spec.txt;type=text/plain")
expect_code "multipart upload-proxy" 200 "$R"

R=$(req GET "/api/v1/evidence/$EV_ID/download")
expect_code "presigned download URL" 200 "$R"
DL_URL=$(body_of "$R" | jq -r .url)
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$DL_URL")
check "download object from MinIO" 200 "$CODE"

# ═════════════════════════════════════════════════════════════
section "7 · AI runs (router → engine → graceful failure without model)"
EVJSON=""
[[ -n "$EV_ID" && "$EV_ID" != "null" ]] && EVJSON=",\"evidence_ids\":[\"$EV_ID\"]"
R=$(req POST "/api/v1/tasks/$TASK_ID/ai/runs" "{\"task_id\":\"$TASK_ID\",\"prompt\":\"What is the max operating temp of the bearing?\"$EVJSON}")
expect_code "start AI run (202 accepted)" 202 "$R"
RUN_ID=$(body_of "$R" | jq -r '.id // empty')

if [[ -n "$RUN_ID" ]]; then
    # Real models (Modal, cold Ollama embeds) can take 30-90s to finish;
    # poll up to 120s for a terminal state instead of one early snapshot.
    STATUS=""
    for _ in $(seq 1 24); do
        sleep 5
        R=$(req GET "/api/v1/ai/runs/$RUN_ID")
        STATUS=$(body_of "$R" | jq -r .status)
        [[ "$STATUS" == "SUCCEEDED" || "$STATUS" == "FAILED" ]] && break
    done
    R=$(req GET "/api/v1/ai/runs/$RUN_ID")
    expect_code "get AI run" 200 "$R"
    check "run reached terminal state" "yes" "$( [[ "$STATUS" == "SUCCEEDED" || "$STATUS" == "FAILED" ]] && echo yes || echo no )"
    printf "  ${c_dim}run status: %s (model endpoint not wired yet — FAILED is expected)${c_off}\n" "$STATUS"
fi

R=$(req GET "/api/v1/tasks/$TASK_ID/ai/runs")
expect_code "list AI runs" 200 "$R"

# ═════════════════════════════════════════════════════════════
section "8 · Approvals"
R=$(req POST /api/v1/approvals "{\"task_id\":\"$TASK_ID\",\"kind\":\"REPORT\",\"summary\":\"Final vibration report needs sign-off\"}")
expect_code "request approval" 201 "$R"
APR_ID=$(body_of "$R" | jq -r .id)

TOKEN="$DRIVER_TOKEN"
R=$(req POST "/api/v1/approvals/$APR_ID/decide" '{"decision":"APPROVED","reason":"matches field readings"}')
check "non-member driver cannot decide (404 expected)" 404 "$(code_of "$R")"

TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req POST "/api/v1/tasks/$TASK_ID/members" '{"user_id":"00000000-0000-0000-0000-000000000005"}')
expect_code "admin invites security approver to the task" 200 "$R"
TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"security@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req POST "/api/v1/approvals/$APR_ID/decide" '{"decision":"APPROVED","reason":"matches field readings"}')
expect_code "security approver decides" 200 "$R"
check "decision recorded" "APPROVED" "$(body_of "$R" | jq -r .state)"

# ═════════════════════════════════════════════════════════════
section "9 · Governance (models · policies · audit · notifications)"
R=$(req GET /api/v1/models)
check "at least 5 seeded model configs" "yes" "$(body_of "$R" | jq -r 'if length >= 5 then "yes" else "no" end')"

R=$(req GET /api/v1/routing-policies)
check "seeded routing policy" "default" "$(body_of "$R" | jq -r '.[0].name')"

R=$(req GET "/api/v1/audit?page_size=5")
expect_code "query audit log" 200 "$R"
check "audit has events" "yes" "$( [[ $(body_of "$R" | jq '.total') -gt 0 ]] && echo yes || echo no )"

R=$(req GET /api/v1/notifications)
expect_code "list notifications" 200 "$R"

# ═════════════════════════════════════════════════════════════
section "10 · Cleanup (created records archived, not deleted)"
TOKEN=""
R=$(req POST /api/v1/auth/login '{"email":"admin@tolti.ai","password":"admin"}'); TOKEN=$(body_of "$R" | jq -r .access_token)
R=$(req PATCH "/api/v1/tasks/$TASK_ID" '{"status":"ARCHIVED"}')
expect_code "archive task" 200 "$R"

# ═════════════════════════════════════════════════════════════
printf "\n${c_bold}RESULT: %s passed · %s failed · %s total${c_off}\n" "$PASS" "$FAIL" "$TOTAL"
[[ $FAIL -eq 0 ]] && printf "${c_green}ALL GREEN${c_off}\n" || printf "${c_red}FAILURES PRESENT${c_off}\n"
exit $FAIL
