# Repository Structure Review

## Current state

The repository has the beginnings of the correct monorepo shape:

- two application areas under `apps/`;
- a generation package under `packages/site-generator/`;
- tenant data under `restaurants/<restaurant-id>/`;
- CI workflow locations under `.github/workflows/`;
- Cloudflare and GitHub infrastructure areas; and
- operator command locations under `scripts/`.

At the time of this review, every existing file is empty, including manifests,
workflows, scripts, sample JSON, documentation, image placeholders, and
infrastructure configuration. Directory and file names therefore indicate
intent, but there is no implemented or enforceable architecture yet.

## Missing or incomplete structure

These are architecture gaps to address during later implementation, not work
performed as part of this documentation task.

### Required for the first working vertical slice

- A `packages/themes/` boundary and one reusable default theme.
- A documented, versioned restaurant configuration schema.
- Shared TypeScript types derived from or kept consistent with that schema.
- A normalized restaurant model that themes and the storefront consume.
- Root and package manifests with valid workspace membership and commands.
- Normal Astro and package layouts. Currently
  `apps/storefront/src/astro.config.mjs` and
  `apps/admin/src/package.json` are misplaced; they belong at their respective
  app roots.
- A real storefront source structure and public assets policy.
- Validation fixtures covering both valid and invalid configuration.
- A safe policy for mapping restaurant IDs to domains and Cloudflare Pages
  projects without embedding credentials in restaurant files.
- Ignore rules for dependencies, environment files, and generated output.

### Required before operating at scale

- Configuration versioning and an explicit migration policy.
- Tenant ID uniqueness and domain uniqueness checks across all restaurant
  directories.
- Asset constraints, optimization rules, and stable asset references that can
  later target R2.
- Isolated build output and cache keys per restaurant.
- CI concurrency controls so two deployments cannot race for the same tenant.
- Preview, promotion, rollback, and audit conventions.
- Secret ownership and GitHub environment protection documentation.
- Observability for validation, build, and deployment failures.

These scale concerns should be added when needed without introducing
restaurant-specific application paths.

## Deliberately not added

The architecture does not currently require:

- a database or API service;
- one package per restaurant;
- one storefront app per restaurant;
- one package per theme;
- a standalone shared-types package;
- runtime multi-tenant request routing;
- R2 integration; or
- a complex plugin system.

Static, configuration-driven builds are sufficient for the MVP and preserve a
path to thousands of restaurants by running the same deterministic pipeline for
each tenant.

## Decision rule for future changes

Before adding a directory or package, identify:

1. the capability it exclusively owns;
2. its public input and output;
3. which existing area is not a suitable owner; and
4. how the dependency direction remains consistent with the architecture.

If the proposed change exists for only one restaurant, first express it as data
or a reusable theme capability. Do not add tenant-specific code.
