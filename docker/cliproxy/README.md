# cliproxy — Claude Max subscription backend

This directory holds the Dockerfile + config for the `cliproxy` dokku app
that sits in front of VibeEdit's Claude traffic and routes it through a
Claude Code OAuth subscription instead of burning API tokens.

## Deploy

Treat this folder as its own tiny repo pushed to a separate dokku app.
`deploy.sh` does the whole dance.

```bash
./docker/cliproxy/deploy.sh
```

What it does:

1. Ensures the `cliproxy` dokku app exists and has a persistent auth volume.
2. Pushes this folder (Dockerfile + config.yaml) to the cliproxy app.
3. Prints the management panel URL so you can run the Claude OAuth flow.

## One-time OAuth

After the first deploy, open the management panel in a browser:

```
http://cliproxy.<your-dokku-host>.sslip.io/management.html
```

Paste the management key from `config.yaml` (`secret-key`), then add a
Claude OAuth credential. The resulting auth file lands in the mounted
`/root/.cli-proxy-api/` volume and survives future redeploys.

## Wire VibeEdit to it

```
ssh dokku@<your-dokku-host> config:set vibeedit \
  ANTHROPIC_BASE_URL=http://cliproxy.<your-dokku-host>.sslip.io \
  ANTHROPIC_API_KEY=vibeedit-internal
```

(The API key value here is the client key defined in `config.yaml`, not an
Anthropic key.)

## ToS reminder

This setup violates Anthropic's terms if you expose the live VibeEdit site
to other users. Fine for personal dev only — swap back to a real
`ANTHROPIC_API_KEY` before onboarding.
