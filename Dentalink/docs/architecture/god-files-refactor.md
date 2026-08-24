# God-file refactor

This document tracks the compatibility-preserving modular refactor of production files that exceeded 1,000 lines at the 2026-08-20 baseline.

## Rules

- Public controllers, routes, DTOs, permissions, response shapes and frontend route exports remain compatible.
- `domain/` is framework independent and cannot import NestJS, Prisma, HTTP clients or persistence services.
- Existing service/page entrypoints remain compatibility facades while responsibilities move into focused units.
- Files are marked `refactored` only after contract, unit, typecheck, lint and build verification.
- `cohesive-exception` requires an explicit rationale in this document; size by itself is not enough to split a declarative or algorithmically cohesive unit.

## Baseline

- 44 production candidates exceeded 1,000 lines after excluding tests, DTOs and declarative catalogs.
- API and web typechecks passed before the refactor.
- Seven critical API suites passed 94 tests; five critical web suites passed 36 tests.
- `PatientsService` had one pre-existing unit-test harness failure caused by an incomplete Prisma mock.
- Root lint had 112 errors and 508 warnings, including archived maintenance and scratch files.

## Phase 1 status

- 13 candidates are refactored below the 1,000-line guard; 30 remain planned.
- `treatment-plan-documents.ts` is the sole cohesive exception: it is a PDF adapter with one public builder, no Nest, Prisma or persistence imports, and tightly coupled graphics state for typography, pagination and odontogram composition.
- API and web route manifests remain unchanged at 705 and 345 declarations respectively.
- Root lint is at 0 errors and 499 warnings; every new extraction file has 0 errors and 0 warnings.
- All 60 API suites pass (378 tests). The production build passes for all workspaces.
- Full web tests retain 11 failures in three pre-existing/concurrently modified areas: route guards, `PatientHeader` router setup in patient-files tests, and advanced permission checklist expectations.
- The strict architecture audit intentionally remains red until the 30 planned candidates are refactored. The default audit is green and rejects new untracked files over 1,000 lines, forbidden `domain/` imports, and undocumented cohesive exceptions.
- `versioned-price-lists-page.tsx` received concurrent local changes during the phase and returned above the threshold; it remains planned so those changes are preserved.
