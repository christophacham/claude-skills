# DefectDojo API cheatsheet (self-hosted)

Base comes from env (not hard-coded in the skill):

- `DEFECTDOJO_URL` — full base, e.g. `http://192.168.50.179:8080`
- or `DEFECTDOJO_HOST` + `DEFECTDOJO_PORT` (default 8080) + optional `DEFECTDOJO_SCHEME` (default http)

Auth: `Authorization: Token <API_TOKEN>` via `DEFECTDOJO_API_TOKEN` / `API_TOKEN`  
Prefer env / `~/.claude/settings.json` `env` / `~/.defectdojo-credentials` — never paste tokens into chat, commits, or PRs.

```bash
# full URL
DD="${DEFECTDOJO_URL:?}"
# or: DD="http://${DEFECTDOJO_HOST}:${DEFECTDOJO_PORT:-8080}"

TOKEN="${DEFECTDOJO_API_TOKEN:-$API_TOKEN}"
AUTH="Authorization: Token ${TOKEN}"
```

## Readiness

```bash
curl -sS -H "$AUTH" "$DD/api/v2/findings/?limit=1&active=true" | jq .count
```

## Products

```bash
curl -sS -H "$AUTH" "$DD/api/v2/products/?limit=200" \
  | jq -r '.results[] | "\(.id)\t\(.name)"'

REPO=christophacham/orca
PID=$(curl -sS -H "$AUTH" --get --data-urlencode "name=$REPO" \
  "$DD/api/v2/products/" \
  | jq -r --arg n "$REPO" '.results[] | select(.name==$n) | .id')
```

## Findings

```bash
# active for product — use nested filter (plain ?product=<id> is a NO-OP on some installs)
curl -sS -H "$AUTH" \
  "$DD/api/v2/findings/?test__engagement__product=$PID&active=true&limit=200" | jq .

# or by exact product name
curl -sS -H "$AUTH" --get \
  --data-urlencode "product_name=christophacham/orca" \
  "$DD/api/v2/findings/?active=true&limit=200" | jq .

# severity filter
curl -sS -H "$AUTH" \
  "$DD/api/v2/findings/?test__engagement__product=$PID&severity=Critical,High&active=true&limit=100" | jq .

# compact
curl -sS -H "$AUTH" \
  "$DD/api/v2/findings/?test__engagement__product=$PID&active=true&limit=200" \
  | jq -c '.results[] | {id,title,severity,file_path,component_name,fix_available,fix_version,cve,tags}'
```

Paginate with `offset` / `limit` until `.next` is null (scripts do this).

## Useful query params

| Param | Notes |
|-------|--------|
| `active` | `true` / `false` |
| `test__engagement__product` | **preferred** numeric product id filter |
| `product_name` | exact product name (e.g. `owner/repo`) |
| `product` | **do not trust** — ignored on some DD versions (returns all findings) |
| `severity` | `Critical`, `High`, … or comma list |
| `duplicate` | often filter client-side if API ignores |
| `limit` / `offset` | pagination |
| `o` | ordering if supported by install |

Finding objects may include `fix_available` and `fix_version` (useful triage signal).

## Optional write-back (only when user asked + fix verified)

Inspect your install’s schema first (`/api/v2/oa3/swagger-ui/`). Typical patterns:

```bash
# notes / mitigation text (field names vary by version)
curl -sS -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"mitigation":"Bumped handlebars to 4.7.9 in package-lock; tests green."}' \
  "$DD/api/v2/findings/${FINDING_ID}/"

# mitigate (confirm field names on your DD version before bulk use)
# curl -sS -X POST -H "$AUTH" ... "$DD/api/v2/findings/${FINDING_ID}/close/"
```

Default skill behavior: **code fix + report**; leave DD state unchanged unless
explicitly requested.

## Swagger

Browser: `{DEFECTDOJO_URL}/api/v2/oa3/swagger-ui/`

## Skill scripts

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/resolve-product.sh" christophacham/orca
bash "${CLAUDE_SKILL_DIR}/scripts/resolve-product.sh" --list
bash "${CLAUDE_SKILL_DIR}/scripts/list-findings.sh" --product christophacham/orca
bash "${CLAUDE_SKILL_DIR}/scripts/list-findings.sh" --product christophacham/orca --severity Critical,High --format json
```
