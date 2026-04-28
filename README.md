# MCP Gitea

Standalone MCP server for secure Gitea access from sandboxed agents. Gitea credentials are stored only on the MCP server side.

This repository mirrors the architecture of `mwaeckerlin/mcp-github`:
- same standalone MCP gateway concept
- same strict validation and allowlist model
- same separation of server config, client config, and tool-call parameters
- same agent-facing README + SKILL approach

## Purpose and Security Model

Sandboxed agents should **not** hold Gitea tokens. Instead:

1. The sandboxed client calls this MCP server.
2. This MCP server (running outside the sandbox) uses the server-side `GITEA_TOKEN`.
3. Calls are limited to validated MCP tools and validated arguments.

The agent does not need a Gitea token. The token is required only on the MCP server side.

Security properties:
- no Gitea token in sandbox/client
- no arbitrary Gitea URL passthrough
- no freeform HTTP proxy tool
- schema-validated tool arguments
- bounded pagination (`limit`, `per_page`, `first`, `last`, `pageSize` are clamped to `1..100`)
- safe error shaping with token redaction

## Exposed MCP Tools

### Discovery
- `gitea_rest_list_operations`: lists allowlisted Gitea API operation IDs and their mapped family.

### REST tool families (full API coverage)
Gitea REST operations are mapped into one of these families:
- `gitea_issues_rest`
- `gitea_pull_requests_rest`
- `gitea_repositories_rest`
- `gitea_users_rest`
- `gitea_organizations_rest`
- `gitea_notifications_rest`
- `gitea_rest_misc`

Each REST family tool takes:
- `operationId` (required, must belong to that family)
- `parameters` (validated object; pagination bounded)

## Tool-Call Parameters

### `gitea_rest_list_operations`
```json
{ "family": "gitea_issues_rest", "limit": 50, "offset": 0 }
```

### Any `*_rest` family tool
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

## How To Use Through MCP

### 1) Check server readiness

Call `GET /healthz`.

- If `status` is `ready`, the server is fully operational.
- If `status` is `degraded`, `GITEA_TOKEN` is missing — only public read calls (GET/HEAD) are available.

### 2) Discover the exact operationId

Call tool `gitea_rest_list_operations` with:

```json
{
  "family": "gitea_issues_rest",
  "limit": 50,
  "offset": 0
}
```

Each operation item includes `operationId`, `method`, `path`, and `parameterNames`.

### 3) Execute the family tool

To list issues in `myorg/myrepo`, call tool `gitea_issues_rest`:

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

To create an issue:

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

## Practical MCP Recipes

### Get current authenticated user

Tool: `gitea_users_rest`

```json
{
  "operationId": "userGetCurrent",
  "parameters": {}
}
```

### Open a pull request

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

### Search repositories

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

### List organization members

Tool: `gitea_organizations_rest`

```json
{
  "operationId": "orgListMembers",
  "parameters": {
    "org": "myorg",
    "limit": 30
  }
}
```

## Configuration

> Production rule: keep `GITEA_TOKEN` server-side only.

### Server configuration

| Variable | Required | Description |
|---|---|---|
| `GITEA_TOKEN` | no | Gitea API token (never passed to sandbox); if missing, server starts in degraded mode |
| `GITEA_URL` | **yes** | Gitea instance base URL (e.g., `https://gitea.example.com`) |
| `MCP_GITEA_HOST` | no | Bind host (default `0.0.0.0`) |
| `MCP_GITEA_PORT` | no | Bind port (default `4000`) |
| `DISABLE_TOOLS` | no | Comma-separated MCP tool names to disable |

### Health status semantics

- `GET /healthz` always returns HTTP `200` while the process is running.
- With token configured: `{ "ok": true, "status": "ready", "giteaTokenConfigured": true }`
- Without token: `{ "ok": true, "status": "degraded", "giteaTokenConfigured": false, "message": "..." }`
- In degraded mode, `gitea_rest_list_operations` is filtered to read-only (`GET`/`HEAD`) operations.

### Client configuration (sandbox/agent environment)

| Variable | Required | Description |
|---|---|---|
| `MCP_GITEA_URL` | yes | URL where the sandbox MCP client reaches this server (e.g., `http://mcp-gitea:4000`) |

## Authentication

The Gitea API is accessed using `Authorization: token <GITEA_TOKEN>` in the HTTP headers. This follows the Gitea API v1 authentication standard.

## Gitea API Reference

- Gitea API v1 docs: [https://try.gitea.io/api/swagger](https://try.gitea.io/api/swagger)
- Gitea API v1 base path: `/api/v1`

## Installation and Usage

```bash
npm install
npm run build
```

Dev mode (requires `GITEA_URL` and optionally `GITEA_TOKEN` in env):
```bash
export GITEA_URL=https://gitea.example.com
export GITEA_TOKEN=your_token_here
npm run dev
```

Tests:
```bash
npm test
```

## Tool Selection Guide

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

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| `Gitea token is not configured...` | Server started without token | Set server-side `GITEA_TOKEN` |
| `operationId ... is not allowlisted for tool ...` | Wrong tool family | Query `gitea_rest_list_operations` and use matching family |
| `Gitea authentication or permission error (401/403)` | Invalid token or insufficient permissions | Rotate token or add required permissions |
| `Gitea resource not found or not accessible` | Missing permission or wrong resource | Validate owner/repo/resource access |
| `Tool disabled by DISABLE_TOOLS` | Tool explicitly disabled | Remove from `DISABLE_TOOLS` or call different tool |
| `GITEA_URL is required` | Server started without URL | Set `GITEA_URL` to your Gitea instance URL |

## SKILL

This repository ships `SKILL.md` for local skill installation and agent-first operating guidance.
