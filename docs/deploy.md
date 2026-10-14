# Deploy — human setup steps

Corn Utopia deploys the same way as `ttsu/mathtactics`: everything is published to a `gh-pages`
branch, and GitHub Pages serves that branch.

| What | Workflow | Where it lands | URL |
|------|----------|----------------|-----|
| Production | `.github/workflows/deploy-github-pages.yml` (every push to `main`, or run by hand) | `gh-pages` root | https://ttsu.github.io/corn-utopia/ |
| PR previews | `.github/workflows/pr-preview.yml` (PR opened / updated / closed) | `gh-pages` under `pr/pr-<N>/` | https://ttsu.github.io/corn-utopia/pr/pr-N/ |

The preview action posts a sticky comment with the preview link on each PR and removes the
preview folder when the PR closes. Production deploys keep the `pr/` folder (`clean-exclude: pr`).

## 1. GitHub Pages settings (one time)

These touch repo settings outside this checkout, so a person has to do them.

1. Let the first workflow run create the `gh-pages` branch (merge to `main`, run **Deploy to
   GitHub Pages** from the Actions tab, or open/update a PR). Don't create it by hand.
2. In **Settings → Pages**, set **Source: Deploy from a branch**, branch **`gh-pages`**,
   folder **`/ (root)`**.
3. In **Settings → Actions → General → Workflow permissions**, make sure workflows can
   **read and write** (the workflows ask for `contents: write` and `pull-requests: write`).

## 2. Branch protection (optional)

In **Settings → Branches**, add a rule for `main` requiring the `CI / ci` check to pass.

## 3. Home Screen install (iPad / iPhone)

1. Open https://ttsu.github.io/corn-utopia/ in Safari.
2. Tap **Share → Add to Home Screen**, then **Add**.
3. Launch from the Home Screen icon for playtests (fullscreen, and Safari won't evict saved
   tuning or playtest logs).

Only add the production URL to the Home Screen. PR previews are for quick checks in a browser
tab: their saved tuning and playtest log use separate storage keys, and the production service
worker never answers requests under `pr/`, so a preview can't overwrite production data or
get stuck on the production build.
