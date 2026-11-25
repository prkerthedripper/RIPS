# RIPS by FCargo — run it yourself

Everything runs on this machine. Two things need to be up: the local Postgres
database and the Next.js dev server.

## The one command

```sh
npm start
```

That is `scripts/dev.mjs`, which:

1. starts the embedded Postgres cluster if it is not already listening on
   127.0.0.1:54329 (and migrates/seeds it on first run),
2. keeps it alive for as long as the script runs,
3. starts the Next.js dev server on http://localhost:3000,
4. stops the database again when you press Ctrl+C.

Leave the window open while you work. Open http://localhost:3000.

## When you only want part of it

```sh
npm run db:up      # just the database
npm run db:down    # stop the database
npm run db:reset   # wipe the data dir, re-migrate and re-seed
npm run db:status  # is it listening?
npm run dev        # just Next.js (expects the database to be up)
```

## Accounts

There is no sign-up wall: `/login` creates an account in one step and gives it
5,000 virtual credits. A seeded admin account exists too:

- username `vaultmaster`
- password `auric-admin` (override with `ADMIN_PASSWORD` before seeding)

## Notes

- The database lives in `.pgdata/` in the project folder. Deleting it (or
  `npm run db:reset`) rebuilds it from `src/db/seed/`.
- To point at a hosted Postgres instead, set `DATABASE_URL`; nothing else
  changes.
- Production: `npm run build && npm run serve` — but `start` is taken by the
  dev helper, so use `npm run serve` for the production server.
