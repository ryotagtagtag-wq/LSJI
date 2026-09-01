---
name: "Good First Issue: Add example plugin for GitHub integration"
about: Create a useful example plugin for the community
title: "[Plugin] Create example GitHub integration plugin"
labels: ["good first issue", "plugin", "example", "help wanted"]
assignees: ""
---

## Description

Create an example plugin that demonstrates how to integrate with GitHub API (create issues, list repos, etc.). This will serve as a reference for plugin developers.

## Tasks

- [ ] Create `lsji-plugins/github.js` with GitHub API tools
- [ ] Include at least 3 tools: `github_create_issue`, `github_list_repos`, `github_get_file`
- [ ] Add proper `requiresApproval: true` for mutating operations
- [ ] Add comprehensive JSDoc comments
- [ ] Test with `lsji plugin load --path ./lsji-plugins`

## Tools to Implement

| Tool | Description | Approval |
|------|-------------|----------|
| `github_create_issue` | Create issue in a repo | Yes |
| `github_list_repos` | List user/org repositories | No |
| `github_get_file` | Get file contents from repo | No |
| `github_search_code` | Search code across repos | No |

## Requirements

- Use `GITHUB_TOKEN` environment variable for auth
- Handle API errors gracefully (return `{ error: "..." }`)
- Follow plugin structure from `lsji-plugins/example.js`
- Include parameter validation with JSON Schema

## Example Structure

```javascript
// lsji-plugins/github.js
export default {
  name: 'github',
  version: '1.0.0',
  tools: {
    github_create_issue: {
      name: 'github_create_issue',
      description: 'Create a GitHub issue',
      category: 'github',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } }
        },
        required: ['owner', 'repo', 'title']
      },
      requiresApproval: true,
      async execute({ owner, repo, title, body, labels }) {
        // Implementation here
      }
    }
    // ... more tools
  }
};
```

## Acceptance Criteria

- [ ] Plugin loads without errors
- [ ] Tools appear in `lsji plugin list`
- [ ] Can be used by agent: `lsji agent run --task "Create issue in my/repo" --provider gemini`
- [ ] Proper error handling for missing token, API errors
- [ ] Follows existing plugin patterns

## Getting Started

```bash
# 1. Copy example plugin
cp lsji-plugins/example.js lsji-plugins/github.js

# 2. Edit with GitHub API calls
# 3. Test loading
lsji plugin load --path ./lsji-plugins

# 4. Test with agent (needs GITHUB_TOKEN)
export GITHUB_TOKEN="your-token"
lsji agent run --task "Create test issue in my/repo" --provider gemini
```

## Resources

- [GitHub REST API](https://docs.github.com/en/rest)
- Plugin system docs: `docs/docs/plugins.md`
- Example plugin: `lsji-plugins/example.js`

## Mentorship

Will review PR and help with API design! Tag @game_ryo.
