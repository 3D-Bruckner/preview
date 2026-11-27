# Final fix report (build-v0.1)

1. Admin metadata leak: generateMetadata in customers/[id] and models/[id] returns the generic title when `runtime().person(await headers())` is null. New e2e (admin.spec.ts): signed-out GET with maxRedirects 0 gives 307 and the body lacks the seeded name/title.
2. Permissions: `process.umask(0o077)` first thing in docker-entrypoint.mjs (dev/`next start` skip the entrypoint on purpose, developer's own). Also files.ts now chmods each stored copy 0600, because copyFile keeps the source's mode (the umask test was RED at 0644 for model.3mf without it). Test backend/umask.test.ts (DB, -wal/-shm and version files under umask 077 have no group/other bits). Verified in the built image: all of /data 0600, folders 0700. docs/configuration.md data section mentions it.
3. Upload total: the kit's readMultipart has no total option (only maxFileBytes/maxFiles), so upload.ts keeps maxFileBytes = total (per-file cap <= total) and sums `f.size` after reading; over the total gives 413 with the existing tooLarge copy. Test: two 600 KB files under a 1 MB limit gives 413 (RED before). Doc line says none alone may exceed it either. Note: the kit still streams the whole oversized request to its temp folder before the sum check (bounded by maxFiles x total).
4. dependabot.yml header reworded (public repo, ruleset, auto-merge for patch/minor, majors by hand).
5. Customer layout: logo img only when `logoFile(config)` is non-null. Unit test app/[lang]/(customer)/layout.test.ts (missing file: no img, RED before; present: img). Named .test.ts because eslint only relaxes the backend-import rule for that suffix.
6. Dockerfile: app copied as root; only /data is chown 1000. Built locally with docker and ran the smoke steps: starts, serves, uploads work (the app does not write to its tree).
7. CI: new step "A customer's page and files are served through their link": CLI token, create customer/model, upload version via /api/models/<id>/versions, `/k/<token>` 200, model page 200, files/<version>/model.3mf 200 with CSP sandbox, bad token 404 (page and file). Both smoke steps run locally against the built image, rc 0.
8. next.config outputFileTracingExcludes added (key "*"), but Next applies it only to page/route traces; instrumentation's and proxy's nft traces still pulled in all of backend/. So the Dockerfile build stage additionally deletes `*.test.ts`, fixtures and testing from .next/standalone/backend (verified: none remain in the image).
9. docs/configuration.md: non-loopback HOSTNAME line.

Verification: lint, format:check, typecheck, vitest (24 files, 124 tests), build all green. e2e: 39 passed. The first two e2e runs failed 5-6 tests (a11y, signed-out redirect, etc.) because I had run `npm run build` in between, which clobbers the .next the dev server shares (it failed identically on the stashed tree); after `rm -rf .next` the run was 39/39. Run the build after e2e, not before.

Not pushed. Single commit on build-v0.1.
