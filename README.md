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
- Browse to `localhost:3001/api/migrations`, copy the last migration title into the last box and hit "up".
- Browse to `localhost:3000`.

## Testing locally

 - `sudo dev/test`

## Resetting the dev database
- `sudo dev/force-rebuild` or
- `sudo dev/clean`

## Migrations

`$host/api/migrations`. They are never run automatically.

## Deploying to staging/prod

Deploy everything like

 - `server staging everything`.

Alternatively, instead of `everything` you can write

 - `server staging [deploy|rollback] [client|api]

to deploy or roll-back either the client or the api server.

## Setting up servers

At the moment the process is,

1. Buy a server,
2. Configure DNS if you like,
3. Run `server $ip-address setup` and follow the instructions. This should install docker and git on the host, authenticate with the docker registry and clone our git repo.
5. Init a docker swarm or join one. (??)
6. Update environment files in the `machines` directory if setting up a new swarm.
