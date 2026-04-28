import type { GiteaRestOperation } from "./gitea-operations.js";

export interface RestToolFamily {
  name: RestToolFamilyName;
  description: string;
}

export const REST_TOOL_FAMILY_NAMES = [
  "gitea_issues_rest",
  "gitea_pull_requests_rest",
  "gitea_repositories_rest",
  "gitea_users_rest",
  "gitea_organizations_rest",
  "gitea_notifications_rest",
  "gitea_rest_misc"
] as const;

export type RestToolFamilyName = (typeof REST_TOOL_FAMILY_NAMES)[number];

interface RestToolFamilyMatcher {
  family: RestToolFamily;
  matches(operation: GiteaRestOperation): boolean;
}

const TOOL_FAMILY_MATCHERS: RestToolFamilyMatcher[] = [
  {
    family: {
      name: "gitea_issues_rest",
      description: "Gitea issue APIs including issue CRUD, comments, labels, and milestones."
    },
    matches: (operation) => operation.tags.includes("issue") && !operation.operationId.toLowerCase().includes("pull")
  },
  {
    family: {
      name: "gitea_pull_requests_rest",
      description: "Gitea pull request APIs including PR metadata, reviews, comments, and merge operations."
    },
    matches: (operation) =>
      operation.tags.includes("pull-request") ||
      (operation.tags.includes("issue") && operation.operationId.toLowerCase().includes("pull"))
  },
  {
    family: {
      name: "gitea_repositories_rest",
      description: "Gitea repository APIs including repo metadata, contents, branches, tags, releases, and collaborators."
    },
    matches: (operation) => operation.tags.includes("repository")
  },
  {
    family: {
      name: "gitea_users_rest",
      description: "Gitea user APIs including user profile, followers, keys, tokens, and starred repositories."
    },
    matches: (operation) => operation.tags.includes("user")
  },
  {
    family: {
      name: "gitea_organizations_rest",
      description: "Gitea organization APIs including org metadata, members, teams, and repositories."
    },
    matches: (operation) => operation.tags.includes("organization")
  },
  {
    family: {
      name: "gitea_notifications_rest",
      description: "Gitea notification APIs for listing and managing user and repository notifications."
    },
    matches: (operation) => operation.tags.includes("notification")
  },
  {
    family: {
      name: "gitea_rest_misc",
      description: "All remaining Gitea REST APIs not covered by the dedicated family tools."
    },
    matches: () => true
  }
];

export function classifyOperationToFamily(operation: GiteaRestOperation): RestToolFamilyName {
  for (const matcher of TOOL_FAMILY_MATCHERS) {
    if (matcher.matches(operation)) {
      return matcher.family.name;
    }
  }
  return "gitea_rest_misc";
}

export function getRestToolFamilies(): RestToolFamily[] {
  const dedup = new Map<RestToolFamilyName, RestToolFamily>();
  for (const matcher of TOOL_FAMILY_MATCHERS) {
    dedup.set(matcher.family.name, matcher.family);
  }
  return [...dedup.values()];
}
