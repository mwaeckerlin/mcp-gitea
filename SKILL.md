---
name: mcp-gitea
description: Use this skill for secure Gitea MCP usage from sandboxed agents — list allowed operations, execute validated REST family tools, and troubleshoot auth/permission issues.
---

# MCP Gitea

Secure MCP bridge for Gitea where credentials are held only on the server side.

## Purpose (sandbox perspective)

This skill exists so sandboxed agents can use Gitea safely **without having a Gitea token**.

- The agent/client uses only `MCP_GITEA_URL`.
- Only the MCP server knows and uses `GITEA_TOKEN`.
- The token must never be copied into the sandbox.

## Local installation (deterministic)

Use these rules when told to install this skill locally.

- **Source file in this repository:** `<repository-root>/SKILL.md`
- **Canonical installed skill file (active location):** `~/.openclaw/workspace/skills/mcp-gitea/SKILL.md`
- **Any other copied file path is not an installation.**

Installation procedure:

1. Ensure `~/.openclaw/workspace/skills/mcp-gitea/` exists.
2. Copy this file to exactly `~/.openclaw/workspace/skills/mcp-gitea/SKILL.md`.
3. Overwrite in place if it already exists.
4. Verify:
   - `openclaw skills list`
   - `openclaw skills detail mcp-gitea`

## First step (preflight)

Always run this preflight sequence:

1. In your sandbox shell, verify the MCP client target URL exists:
   - `echo "$MCP_GITEA_URL"`
   - Expected: non-empty URL like `http://mcp-gitea:4000`
2. If empty, stop. You cannot use this skill until `MCP_GITEA_URL` is available.
3. Check `GET /healthz`.
4. If `status` is `degraded`, `GITEA_TOKEN` is missing — only public read calls (GET/HEAD) are available.
5. Call `gitea_rest_list_operations` before any REST family call.

Do not call REST execution tools before preflight succeeds.

## MCP transport preflight (required)

For MCP HTTP requests, the client must send an `Accept` header that allows both:
- `application/json`
- `text/event-stream`

## Parameter discovery workflow

For each REST operation, discover parameters in this order:

1. Call `gitea_rest_list_operations` with the target family.
2. Select the returned operation entry.
3. Use operation metadata from that entry:
   - `operationId`
   - `method`
   - `path`
   - `parameterNames`
4. Build the `parameters` object for the matching family tool.

## Example: create an issue

Step A — discover operation:

Tool: `gitea_rest_list_operations`

```json
{
  "family": "gitea_issues_rest",
  "limit": 50,
  "offset": 0
}
```

Find operation `issueCreateIssue` and inspect `parameterNames`.

Step B — execute:

Tool: `gitea_issues_rest`

```json
{
  "operationId": "issueCreateIssue",
  "parameters": {
    "owner": "myorg",
    "repo": "myrepo",
    "title": "Example issue via MCP",
    "body": "Created through mcp-gitea."
  }
}
```

Step C — verify:

Tool: `gitea_issues_rest`

```json
{
  "operationId": "issueListIssues",
  "parameters": {
    "owner": "myorg",
    "repo": "myrepo",
    "state": "open",
    "limit": 30
  }
}
```

## More practical examples

Get authenticated user:

Tool: `gitea_users_rest`

```json
{
  "operationId": "userGetCurrent",
  "parameters": {}
}
```

Create pull request:

Tool: `gitea_pull_requests_rest`

```json
{
  "operationId": "repoCreatePullRequest",
  "parameters": {
    "owner": "myorg",
    "repo": "myrepo",
    "title": "My PR via MCP",
    "head": "feature-branch",
    "base": "main",
    "body": "Created through mcp-gitea"
  }
}
```

Merge pull request:

Tool: `gitea_pull_requests_rest`

```json
{
  "operationId": "repoMergePullRequest",
  "parameters": {
    "owner": "myorg",
    "repo": "myrepo",
    "index": 42,
    "Do": "merge",
    "merge_message_field": "Merged via MCP"
  }
}
```

Search repositories:

Tool: `gitea_repositories_rest`

```json
{
  "operationId": "repoSearch",
  "parameters": {
    "q": "mcp",
    "limit": 20
  }
}
```

List organization teams:

Tool: `gitea_organizations_rest`

```json
{
  "operationId": "orgListTeams",
  "parameters": {
    "org": "myorg",
    "limit": 30
  }
}
```

## Tool selection guide

| Goal | Tool |
|---|---|
| Discover valid operation IDs | `gitea_rest_list_operations` |
| Issues, comments, labels, milestones | `gitea_issues_rest` |
| Pull requests, reviews, merges | `gitea_pull_requests_rest` |
| Repositories, branches, tags, releases, files | `gitea_repositories_rest` |
| Users, followers, SSH keys, tokens | `gitea_users_rest` |
| Organizations, teams, memberships | `gitea_organizations_rest` |
| Notifications | `gitea_notifications_rest` |
| Remaining endpoints | `gitea_rest_misc` |

## Complete tool list

`gitea_rest_list_operations` · `gitea_issues_rest` · `gitea_pull_requests_rest` · `gitea_repositories_rest` · `gitea_users_rest` · `gitea_organizations_rest` · `gitea_notifications_rest` · `gitea_rest_misc`

## Troubleshooting

| Error contains | Cause | Action |
|---|---|---|
| `operationId ... is not allowlisted` | Wrong operation/tool family combination | List operations and pick matching family |
| `Gitea token is not configured` | Server runs without `GITEA_TOKEN` | Configure server-side `GITEA_TOKEN` and retry |
| `Gitea authentication or permission error` | Bad token or missing permissions | Fix `GITEA_TOKEN` on server side |
| `Gitea resource not found or not accessible` | Missing access rights or wrong identifiers | Validate org/repo/path and token permissions |
| `Tool disabled by DISABLE_TOOLS` | Server-side tool restriction | Use enabled tool or update server config |
| `GITEA_URL is required` | Server misconfiguration | Set `GITEA_URL` to your Gitea instance URL |

## Safe operating rules

- Never put Gitea tokens in sandbox prompts or tool arguments.
- Do not attempt raw arbitrary Gitea HTTP calls.
- Use only allowlisted MCP tools with validated inputs.
- Keep list/pagination requests bounded and explicit.
- Always run preflight (`/healthz` + `gitea_rest_list_operations`) before mutation-style REST calls.
