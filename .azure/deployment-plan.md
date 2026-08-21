# Fretboard Lab Azure Deployment Plan

## Status

Deployed - Verifying CI/CD

## Application

- Repository: `Naytron/guitar-fretboard`
- Branch: `main`
- Mode: MODERNIZE
- Components: static HTML, CSS, and browser JavaScript
- Backend, API, database, and runtime secrets: none

## Confirmed requirements

- Classification: personal production site without a formal SLA requirement
- Traffic: fewer than 1,000 users per month
- Budget: up to $25/month; target cost is $0/month
- Compliance: no special regulatory or organizational requirements
- Subscription: the Visual Studio Enterprise subscription only
- Location: West US 2
- Hostname: Azure-provided HTTPS hostname
- Custom domain: not in scope
- Rollback host: keep GitHub Pages enabled during Azure validation

## Architecture

```text
Naytron/guitar-fretboard main
  -> pinned, least-privilege GitHub Actions workflow
  -> dependency-free npm build into dist/
  -> Azure Static Web Apps deployment action
  -> Azure Static Web Apps Free in West US 2
  -> Azure-provided HTTPS hostname
```

| Resource | Planned name | SKU | Purpose |
|---|---|---|---|
| Resource group | `rg-fretboard-lab-prod` | N/A | Production resource boundary |
| Static Web App | `swa-fretboard-lab-prod-<unique>` | Free | Static hosting, TLS, and global distribution |

No API, managed identity, Key Vault, storage account, database, private endpoint, or dedicated
monitoring resource is required.

## Azure context

- Subscription: `Visual Studio Enterprise Subscription`
  (`ebad4aa3-a0cd-4231-a343-b690479b1a67`)
- Tenant: `e8d534e4-5341-4a29-be9b-40efe2659c14`
- Location: `westus2`
- `Microsoft.Web` provider: Registered
- Static Web Apps availability: West US 2 is supported.
- Existing Static Web Apps: 0
- Quota result: no limit reported for `Microsoft.Web/staticSites`; planned usage is 1.
- Policy review:
  - Azure Security Center default assignment is audit-only.
  - A West Europe restriction does not affect West US 2.
  - MFA is required for resource write and delete operations.

## Deployment recipe

Use Azure Developer CLI with Bicep for reproducible infrastructure and application deployment.
A dependency-free Node script will copy an explicit allowlist of public files to `dist/`. This
keeps repository metadata, infrastructure, scripts, and workflow files out of the hosted site.

Planned repository artifacts:

- `azure.yaml`
- `infra/main.bicep`
- `infra/main.parameters.json`
- `package.json`
- `package-lock.json`
- `scripts/build.mjs`
- `scripts/test.mjs`
- `staticwebapp.config.json`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.gitignore` updates
- `README.md` deployment documentation

The GitHub workflows will:

- Run continuous integration on pull requests and pushes to `main`.
- Gate automatic production deployment on a successful `main` CI run, with manual dispatch also
  available.
- Pin third-party actions to immutable commit SHAs.
- Use explicit `contents: read` permissions and production concurrency.
- Run `npm ci`, application accuracy tests, and `npm run build` in CI.
- Reuse the exact versioned artifact that passed the CI test and verification steps.
- Deploy `dist/` with `skip_app_build: true` and an empty output location.
- Read the deployment token only from `AZURE_STATIC_WEB_APPS_API_TOKEN`.

The token will be retrieved only after provisioning and piped directly to the GitHub secret
without writing or printing it.

Each deployment will receive an immutable label in the form
`v<package-version>+<short-commit-sha>` (for example, `v1.0.0+309bc9b`). The deployment workflow
will use this label in the GitHub job and step summary, embed it visibly in both deployed pages,
and publish it as `/version.json` for machine-readable verification. Source-hosted GitHub Pages
will show the base package version.

## Security

- HTTPS is provided and renewed by Azure Static Web Apps.
- Static Web Apps response headers will deny framing, disable MIME sniffing, and apply a
  same-origin content security policy compatible with the existing site.
- No credentials, deployment tokens, or local Azure environment files will be committed. The
  non-secret subscription and tenant IDs are recorded only to prevent deployment to the wrong
  account.
- CI permissions will be least privilege.
- No destructive Azure action is planned.

## Execution checklist

- [x] Analyze the application and classify the deployment.
- [x] Confirm scale, budget, compliance, region, hostname, and rollback requirements.
- [x] Select Azure Static Web Apps Free and the AZD plus Bicep recipe.
- [x] Confirm current Azure schemas, deployment action SHA, and supported configuration.
- [x] Authenticate to the Visual Studio Enterprise account.
- [x] Confirm the exact subscription ID and West US 2.
- [x] Inspect Azure Policy assignments.
- [x] Check Static Web Apps provisioning availability and limits.
- [x] Generate AZD, Bicep, build, security, CI/CD, and documentation artifacts.
- [x] Verify pull-request and `main` continuous integration behavior.
- [x] Verify successful CI gates the production deployment and labels its exact version.
- [x] Run note and chord accuracy tests.
- [x] Run a clean dependency install and deterministic build.
- [x] Inspect the `dist/` deployment boundary.
- [x] Smoke-test both pages locally.
- [x] Set this plan status to `Ready for Validation`.
- [x] All validation checks pass.
  - [x] AZD installation
  - [x] Azure YAML schema validation
  - [x] AZD environment setup
  - [x] AZD authentication
  - [x] Subscription and location
  - [x] Aspire pre-provisioning checks (not applicable)
  - [x] Provision preview
  - [x] Build verification
  - [x] Docker build context validation (not applicable)
  - [x] Package validation
  - [x] Azure Policy validation
  - [x] Aspire post-provisioning checks (not applicable)
- [x] Invoke `azure-validate` and resolve all blocking findings.
- [x] Invoke `azure-deploy`.
- [x] Configure the GitHub deployment secret without exposing it.
- [x] Verify both pages, assets, navigation, responsive behavior, and accuracy badges on Azure.
- [x] Record the Azure hostname and deployment evidence.
- [ ] Commit and push deployment artifacts.
- [ ] Verify the production GitHub Actions deployment.
- [x] Keep GitHub Pages enabled as rollback.

## Preparation evidence

- `npm ci --ignore-scripts --no-audit --no-fund` completed from the refreshed lockfile.
- All 5 note-engine checks, all 10 chord-engine checks, 7 JavaScript syntax checks, and both
  page-shell security checks passed.
- The deterministic build produced exactly the 9 allowlisted public files, and
  `npm run verify:dist` confirmed matching `v1.0.0+validation` labels.
- Local browser verification confirmed the G Major scale and all 9 chord cards rendered, both
  in-browser accuracy badges passed, the dark theme applied, and neither page overflowed
  horizontally.
- Workflow review confirmed CI runs for pull requests and `main`, production deployment is gated
  on the successful `main` build job, the exact tested artifact is reused, the version label is
  propagated end-to-end, action revisions are immutable, and only the named deployment secret is
  passed to the reusable workflow.

## Section 7: Validation Proof

- Validation completed: `2026-08-21T19:42:14Z` (UTC)

| Check | Command or method | Result |
|---|---|---|
| AZD installation | `azd version` | Passed with AZD 1.25.6 |
| Azure YAML schema | Azure AZD `validate_azure_yaml` | Passed against the stable schema |
| AZD environment | `azd env list` and `azd env get-values --environment prod` | `prod` targets the confirmed subscription and `westus2` |
| Authentication | `azd config set auth.useAzCliAuth true` and `azd auth login --check-status` | Passed using the authenticated Azure CLI account |
| Bicep compile and lint | `az bicep build --stdout` and `az bicep lint` | Passed without warnings or errors |
| ARM template validation | `az deployment sub validate` | `Succeeded` |
| ARM what-if | `az deployment sub what-if --result-format ResourceIdOnly` | Creates only the planned resource group and Static Web App |
| AZD provision preview | `azd provision --preview --environment prod --no-prompt` | Passed; two planned creates and no changes applied |
| Clean build | `npm ci`, `npm test`, `npm run build`, `npm run verify:dist` | Passed; all tests and the nine-file boundary passed |
| AZD package | `azd package --environment prod --no-prompt` | Passed; `web` packaged from `dist/` |
| Azure Policy | Azure Policy assignment review | West US 2 and the Free Static Web App comply; write operations require MFA |
| Aspire and Docker | Workspace scan | Not applicable |

## Role Assignment Verification

- Status: Verified
- Identities checked: none; this public static site has no managed identity or backend identity.
- Roles confirmed: none required by the application infrastructure.
- Issues: none.

## Deployment execution

- Pre-deploy check completed: `2026-08-21T19:42:14Z` (UTC)
- Confirmed subscription: `Visual Studio Enterprise Subscription`
  (`ebad4aa3-a0cd-4231-a343-b690479b1a67`)
- Confirmed location: `westus2`
- Confirmed the target resource group does not already exist.
- Confirmed the interactive deployment identity is a user and no Bicep RBAC principal-type
  compatibility changes are required.

### Azure deployment evidence

- Provisioned: `2026-08-21T19:44:04Z` (UTC)
- Resource group: `rg-fretboard-lab-prod`
- Static Web App: `swa-fretboard-lab-prod-qrnmh2ac5v22y` (Free, West US 2)
- Endpoint: `https://orange-grass-0f2e6e11e.7.azurestaticapps.net/`
- Bootstrap deployment: `v1.0.0+bootstrap`
- HTTP verification: `index.html`, `chords.html`, and `version.json` returned HTTP 200; both pages
  contained the matching version and self-test marker.
- Security verification: Content Security Policy and `X-Frame-Options: DENY` were present.
- GitHub secret configured: `AZURE_STATIC_WEB_APPS_API_TOKEN` at `2026-08-21T19:46:14Z` (UTC);
  its value was piped directly from Azure and was not printed or written to disk.
- GitHub Pages rollback: `https://naytron.github.io/guitar-fretboard/` returned HTTP 200.

### Live Role Verification

- App identities: none.
- Role assignments required by the application: none.
- Status: Passed; live RBAC verification is not applicable to this public static-only workload.

## Acceptance criteria

- Bicep compiles and validates for the confirmed subscription.
- AZD resolves the `web` service and `dist` output.
- Note tests, chord tests, clean install, and build pass.
- `dist/` contains only intended public files and Static Web Apps configuration.
- The Free Static Web App is provisioned in West US 2 in `rg-fretboard-lab-prod`.
- Both pages work over the Azure HTTPS hostname without missing assets or browser errors.
- Scale and chord accuracy badges pass on Azure.
- The GitHub production workflow succeeds with least-privilege permissions.
- The deployed page and `/version.json` report the same version label as the GitHub deployment.
- No credential or deployment token appears in git or logs.
- GitHub Pages remains available.

## Rollback

- Redeploy the last known-good commit for application rollback.
- Reapply Bicep for infrastructure recovery.
- Continue using `https://naytron.github.io/guitar-fretboard/` if Azure validation fails.
- Do not disable GitHub Pages or delete resources as part of this deployment.

## References

- [Azure Static Web Apps overview](https://learn.microsoft.com/azure/static-web-apps/overview)
- [Deploy Azure Static Web Apps with Bicep](https://learn.microsoft.com/azure/static-web-apps/publish-bicep)
- [Static Web Apps build configuration](https://learn.microsoft.com/azure/static-web-apps/build-configuration)
