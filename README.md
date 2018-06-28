## Code layout

# /client

Contains client stuff. This includes "microservice" server stuff, because they're really just headless clients.

# /server

Contains the things necessary to store documents in the database.

## Dev setup

 - Get Node and run `yarn run devsetup` in the repo root.
 - Get Docker and Docker Compose.

## Running the dev server
- `sudo scripts/run`
- `sudo scripts/migrate` (in another window)

Migrations must be run while postgres is going (i.e., `scripts/run`.)

## Testing locally

 - `sudo scripts/test`

## Resetting the dev database
- `sudo scripts/force-rebuild` or
- `sudo scripts/clean`

## Migrations in development

Make a migration by running `scripts/create-migration <name>`

Run migrations up/down like
- `sudo scripts/migrate up`
- `sudo scripts/migrate down`

Specify a migration to stop at like so:
- `sudo scripts/migrate up 1529298053617-docs-prettyId-col`

If you provide no arguments, a single argument of `up` is assumed as a shortcut.

## Deploying to staging/prod

Dunno lol.

## Migrations in production

Dunno lol.
