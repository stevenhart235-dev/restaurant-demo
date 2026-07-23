# Restaurant Website Platform Architecture

## Purpose

This repository is a multi-tenant website generation platform. It is not the
source code for any single restaurant website.

One application and one set of themes must support every restaurant. A
restaurant is selected at build time and its website is produced from validated
configuration and assets. Adding a restaurant must not require changing
application, generator, or theme code.

The MVP should stay a small monorepo. New packages should be introduced only
when they establish a real ownership boundary.

## Architectural principles

1. **Configuration is the tenant boundary.** A restaurant directory contains
   data and assets only.
2. **Code is shared.** Restaurant names, IDs, domains, menu items, and exceptions
   must not be encoded in application code.
3. **Inputs are validated before rendering.** Invalid configuration stops the
   build with an actionable error.
4. **Themes are presentation, not business logic.** They render a stable,
   normalized model.
5. **Generation is deterministic.** The same code, theme, and configuration
   produce the same site output.
6. **Generated output is disposable.** Build artifacts are never a source of
   truth and should not be edited.
7. **Infrastructure is separate from product behavior.** Deployment concerns
   do not leak into storefront components or restaurant configuration.

## Major directories

The intended repository structure is:

```text
.
├── .github/
│   └── workflows/
├── apps/
│   ├── admin/
│   └── storefront/
├── docs/
│   └── architecture/
├── infrastructure/
│   ├── cloudflare/
│   └── github/
├── packages/
│   ├── menu-parser/
│   ├── shared/
│   ├── site-generator/
│   └── themes/
├── restaurants/
│   └── <restaurant-id>/
├── scripts/
├── package.json
└── pnpm-workspace.yaml
```

### `.github/`

Owns repository automation. Workflows validate all shared code and restaurant
configuration, build one selected restaurant, and deploy generated output to
Cloudflare Pages.

Workflows may call scripts or package commands, but should not reimplement
validation or generation rules in YAML.

### `apps/`

Contains independently runnable product applications.

#### `apps/storefront/`

The Astro application used to render every public restaurant website. It owns
shared pages, layouts, components, accessibility behavior, SEO integration, and
the interface through which a selected theme is rendered.

It consumes only the normalized restaurant model supplied by the site generator.
It must not read arbitrary restaurant files, choose deployment targets, contain
restaurant-specific branches, or provide an editing interface.

The app manifest, Astro config, and TypeScript config belong at
`apps/storefront/`; application source belongs at `apps/storefront/src/`.

#### `apps/admin/`

The private management application. Its eventual responsibility is to let an
authorized operator create and edit restaurant configuration through the same
configuration contract used by builds.

It does not render public sites, define themes, deploy sites, or become an
alternate source of truth. For the MVP it may remain a documented placeholder
until an editing workflow is needed.

The app manifest and build configuration belong at `apps/admin/`; application
source belongs at `apps/admin/src/`.

### `packages/`

Contains reusable platform capabilities with explicit public APIs. Packages
must not import from `apps/`, `restaurants/`, `scripts/`, or `infrastructure/`.

#### `packages/shared/`

Owns small, platform-wide primitives that are genuinely shared across package
boundaries. It must remain dependency-free and must not become a catch-all for
business logic. Restaurant and menu schemas do not belong here unless a later
architecture decision explicitly moves their ownership.

#### `packages/menu-parser/`

Owns conversion of supported menu source formats into a generator-consumable
menu representation. It may depend on `shared`, but not on the site generator,
themes, applications, tenant directories, or infrastructure. Menu schemas and
parsing behavior are intentionally deferred until that feature is designed.

#### `packages/site-generator/`

Owns the generation pipeline and the restaurant configuration contract. Its
responsibilities are:

- load the selected restaurant's configuration;
- validate required fields and reject unknown or invalid values;
- normalize source files into a stable model;
- resolve the configured theme from an allowlist;
- invoke the storefront build with explicit inputs; and
- report deterministic, actionable build errors.

It does not contain restaurant data, visual components, admin UI, GitHub Actions
logic, Cloudflare credentials, or deployment behavior.

For the simple MVP, schemas and shared TypeScript types should remain in this
package. A separate configuration package is justified only when multiple
consumers cannot use the generator's public contract cleanly.

#### `packages/themes/`

Owns the finite set of platform-supported themes and their shared theme
interface. Each theme maps the normalized restaurant model to presentation:
layouts, components, design tokens, typography, and supported display options.

Themes must not read files from `restaurants/`, call infrastructure services, or
branch on a restaurant ID. Differences between restaurants are expressed
through validated theme options. A one-off restaurant design either becomes a
reusable theme or is out of scope for the platform.

Start with one package containing a small theme registry. Split individual
themes into packages only if independent ownership or release cycles make that
necessary.

### `restaurants/`

Contains tenant source data, grouped by stable restaurant ID:

```text
restaurants/<restaurant-id>/
├── restaurant.json
├── menu.json
└── assets/
```

`restaurant.json` contains identity, contact details, locations, hours, domain,
theme selection, and supported theme options. `menu.json` contains structured
menu data. `assets/` contains tenant-owned source images and similar static
files; these can move to R2 later without changing the normalized model.

Restaurant directories may contain configuration and assets only. They must not
contain TypeScript, Astro components, CSS overrides, build scripts, secrets, or
generated output. All files must conform to the versioned contract owned by the
site generator.

### `scripts/`

Contains thin command-line entry points for operator and CI tasks such as
creating, validating, building, and deploying a restaurant. Scripts coordinate
package APIs and infrastructure commands; they do not own schemas, generation
rules, templates, or restaurant exceptions.

### `infrastructure/`

Owns hosting and repository-platform configuration.

`infrastructure/cloudflare/` documents and configures Cloudflare Pages, domains,
and eventually R2. `infrastructure/github/` documents repository setup,
environments, secrets, and workflow prerequisites. Infrastructure consumes
generated output and must not decide how a restaurant site is rendered.

### `docs/`

Contains durable product and engineering decisions. `docs/architecture/` is the
source of truth for repository boundaries and should be updated when those
boundaries change.

### Root files

The root `package.json` owns monorepo-level commands and development tooling; it
is not an application package. `pnpm-workspace.yaml` lists workspace members.
`.env.example` documents variable names and safe placeholders only. The root
`README.md` should be the short contributor entry point and link here.

## Boundary summary

| Area                     | Receives                                          | Produces                                           | Must not own                               |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| Restaurant configuration | Human/admin input and assets                      | Versioned tenant data                              | Executable code or secrets                 |
| Site generator           | Raw tenant data and a restaurant ID               | Validated normalized model and build orchestration | UI, themes, or deployment                  |
| Themes                   | Normalized model and supported options            | Reusable presentation                              | Tenant lookup or tenant exceptions         |
| Storefront               | Normalized model and selected theme               | Static public website                              | Editing, tenant persistence, or deployment |
| Admin                    | Authorized operator input and the config contract | Valid restaurant configuration                     | Public rendering or theme implementation   |

The allowed dependency direction is:

```text
restaurant configuration
          │
          ▼
    site generator ──────► themes
          │                  │
          └────────┬─────────┘
                   ▼
               storefront
                   │
                   ▼
          static build output
                   │
                   ▼
        Cloudflare infrastructure
```

The admin writes configuration through the same contract at the left of this
flow. It does not sit in the build or rendering path.

## Build and deployment flow

1. A command or workflow receives an explicit restaurant ID.
2. The site generator loads only that restaurant directory.
3. It validates and normalizes the configuration.
4. It resolves a supported theme and passes explicit build inputs to Astro.
5. The storefront renders static output into an isolated build directory.
6. CI deploys that output to the restaurant's configured Cloudflare Pages
   target.

No step should infer a restaurant from hard-coded application state. Build
output for different restaurants must not share a writable directory.

## Testing boundaries

When implementation begins, tests should follow ownership:

- site-generator tests cover schema validation, normalization, and deterministic
  input selection;
- theme tests cover the shared theme contract and representative rendering;
- storefront tests cover shared page behavior and accessibility;
- configuration validation covers every directory under `restaurants/`; and
- workflow validation confirms that CI calls the owned commands.

End-to-end tests should use generic fixture restaurants, not production tenants
with special-case expectations.
