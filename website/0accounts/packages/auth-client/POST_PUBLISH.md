# Post-publish checklist

After `pnpm publish` succeeds for a new auth-client version, update the
consumers to use the versioned dependency instead of the `file:` link.

## 1. Publish

```bash
cd 0shared/packages/auth-client
export GITHUB_PACKAGES_TOKEN=<PAT with packages:write scope>
pnpm build
pnpm publish --no-git-checks
```

Both consumer projects already have a correct `.npmrc`:

```
@0zerosdesign:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

## 2. Migrate 0colors

```bash
cd 0colors/packages/frontend
# Edit package.json: change
#   "@0zerosdesign/auth-client": "file:../../../0shared/packages/auth-client"
# to
#   "@0zerosdesign/auth-client": "^0.2.0"

cd ../..
export GITHUB_PACKAGES_TOKEN=<your PAT>
npm install
npm run build
# Verify the build succeeds and no "Could not resolve" errors appear
```

## 3. Migrate 0research

```bash
cd 0research
# Edit package.json: change
#   "@0zerosdesign/auth-client": "file:../0shared/packages/auth-client"
# to
#   "@0zerosdesign/auth-client": "^0.2.0"

export GITHUB_PACKAGES_TOKEN=<your PAT>
pnpm install
pnpm build
```

## 4. Verify

- Sign in on 0colors via accounts.zeros.design — round-trip works.
- Sign in on 0research — same.
- Both products show the same auth behavior they did before the migration.

## Rolling back

If publish went badly, revert consumer `package.json` files back to the
`file:` syntax and re-run install. You can also deprecate a bad version:

```bash
npm deprecate @0zerosdesign/auth-client@0.2.0 "yanked" \
  --registry=https://npm.pkg.github.com
```

## PAT setup (one-time)

Create a GitHub Personal Access Token (classic) with these scopes:

- `read:packages` — for consuming (everyone needs this)
- `write:packages` — for publishing (maintainers only)
- `repo` — needed because `@0zerosdesign` is a private-repo scope

Export it as `GITHUB_PACKAGES_TOKEN` in the shell (or add to
`~/.zshenv`). The `.npmrc` files in all three projects read this env var.
