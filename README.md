## Code layout

# /client

Contains client stuff. This includes "microservice" server stuff, because they're really just headless clients.

# /server

Contains the things necessary to store documents in the database.

## Dev setup

 - Get Docker and Docker Compose.
 - `cp .env.sample .env`.

## Running the dev server
- `sudo dev/run`
- `sudo dev/migrate` (in another window)

Migrations must be run while postgres is going (i.e., `dev/run`.)

## Testing locally

 - `sudo dev/test`

## Resetting the dev database
- `sudo dev/force-rebuild` or
- `sudo dev/clean`

## Migrations in development

Make a migration by running `dev/create-migration <name>`

Run migrations up/down like
- `sudo dev/migrate up`
- `sudo dev/migrate down`

Specify a migration to stop at like so:
- `sudo dev/migrate up 1529298053617-docs-prettyId-col.js`

If you provide no arguments, a single argument of `up` is assumed as a shortcut.

## Migrations in production

By default the server is in one of two migration states:
 - Pinned to some migration filename, or
 - Auto-upgrade.
Not sure which is best, but for now let's have a cultural assumption we're in "auto-upgrade" mode unless you know otherwise. To run a migration, do

 - `server staging migrate up`, or
 - `server staging everything`.

To pin, write

 - `server staging migrate up 1529298053617-docs-prettyId-col.js`, or
 - `server staging migrate down 1529298053617-docs-prettyId-col.js`.

Not sure why the direction is important, to be honest. If we're already on the version you want to pin to it probably doesn't matter, otherwise it's probably best to get it right.

Unlike local migrations, "all the way down" is not supported in production :-).

## Deploying to staging/prod

Deploy everything like

 - `server staging everything`.

This will also run all pending migrations.

Alternatively, instead of `everything` you can write

 - `server staging [deploy|rollback] [client|api]

to deploy or roll-back either the client or the api server. This won't run migrations.

## Setting up servers

At the moment the process is,

1. Buy a server,
2. Configure DNS if you like,
3. Run `server $ip-address setup` and follow the instructions. This should install docker and git on the host, authenticate with the docker registry and clone our git repo.
5. Init a docker swarm or join one. (??)
6. Update environment files in the `machines` directory if setting up a new swarm.
