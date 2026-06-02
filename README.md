# AgentWorld

AgentWorld is a team-level Agent governance console for Agent directories, Agent teams, task definitions, runtime bindings, knowledge spaces, Skills, codebases, connectors, and execution traces.

The repository is designed for internal-network deployment. Runtime assets, fonts, and knowledge storage stay local to the repository or the deployment data directory. The only external dependency class expected during install is npm packages.

## Runtime Assumptions

- Node.js 20+ is installed on the target machine.
- pnpm 9+ is available, or Corepack can activate it.
- SQLite uses Node's built-in `node:sqlite`.
- The default CLI command starts production mode. Development mode is explicit.
- No vendored runtime directory, Node.js archive, external knowledge binary, Python wheelhouse, or Docker service is required.

## Knowledge Engine

AgentWorld uses its built-in knowledge engine instead of an external knowledge service.

The built-in engine provides:

- Knowledge spaces for global, team, project, and Agent-team scopes.
- Markdown knowledge entries with local version history.
- Local L0/L1/L2 retrieval views: space abstract, space overview, and original source read.
- Skill and task knowledge write-back into SQLite plus local shadow files.
- Knowledge import from files, directories, and URLs.
- Local smoke and doctor checks through `pnpm knowledge:*`.

Knowledge storage is created under:

```bash
data/knowledge-engine/
```

## Install

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm build
```

Or use the CLI:

```bash
node scripts/agentworld-cli.mjs install
```

## Start

Production mode is the default:

```bash
pnpm start
```

or:

```bash
node scripts/agentworld-cli.mjs start
```

The service listens on `PORT` or `7369` by default.

Development mode must be explicit:

```bash
pnpm dev
```

or:

```bash
node scripts/agentworld-cli.mjs dev
```

## Upgrade

```bash
node scripts/agentworld-cli.mjs upgrade
```

The upgrade command requires a clean git worktree, pulls with `--ff-only`, reinstalls packages from the lockfile, runs bootstrap, prepares local knowledge storage, and rebuilds the app.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm i18n:audit
pnpm knowledge:smoke
```

Useful CLI checks:

```bash
node scripts/agentworld-cli.mjs doctor
pnpm knowledge:prepare
pnpm knowledge:doctor
```

## Linux Package

Build the Linux package on Linux:

```bash
pnpm package:linux
```

The package includes the standalone Next.js app, public assets, docs, and empty local knowledge-engine directories. It does not bundle Node.js or development data; the target host must provide `node` in `PATH`.

Start the unpacked package:

```bash
./agentworld
```

## Environment

Common variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `7369`. |
| `HOSTNAME` | Listen host for packaged production start, default `0.0.0.0`. |
| `AGENTWORLD_DATA_DIR` | Optional data directory override. |
| `KNOWLEDGE_ENGINE_MODEL_DEFAULTS_FILE` | Optional model defaults JSON for content understanding and embeddings. |
| `KNOWLEDGE_ENGINE_VLM_PROVIDER` | Optional content-understanding provider. |
| `KNOWLEDGE_ENGINE_VLM_MODEL` | Optional content-understanding model. |
| `KNOWLEDGE_ENGINE_EMBEDDING_PROVIDER` | Optional embedding provider. |
| `KNOWLEDGE_ENGINE_EMBEDDING_MODEL` | Optional embedding model. |

## Project Layout

```text
src/app                     Next.js routes and API routes
src/components              UI components
src/server                  Server-side domain logic and SQLite access
src/locales                 Built-in language packs
scripts                     CLI, bootstrap, audit, knowledge, and packaging scripts
public                      Local static assets and fonts
data/knowledge-engine       Local knowledge shadow storage
docs                        Architecture and product specifications
```

## Key Pages

| Path | Purpose |
| --- | --- |
| `/overview` | Overall task board. |
| `/team-wallboard` | Task dashboard grouped by task definition. |
| `/agents` | Agent directory. |
| `/agent-teams` | Agent team composition. |
| `/task-blueprints` | Task definitions and triggers. |
| `/knowledge` | Built-in knowledge workspace. |
| `/skills` | Skill catalog and import. |
| `/settings` | System configuration. |
