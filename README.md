## Code layout

# /client

Contains client stuff. This includes "microservice" server stuff, because they're really just headless clients.

# /server

Contains the things necessary to store documents in the database.

## Dev setup

The client should be fairly simple, I think the server is complicated :-/

 - Install yarn somehow,
 - Install PostgreSQL 10.4 somehow,
 - Make a `.pgpass` file somewhere. It should have these lines:
   ```
   localhost:5432:postgres:postgres:${the postgres user password}
   localhost:5432:sheets_db_dev:postgres:${the postgres user password}
   localhost:5432:sheets_db_dev:sheets_user_dev:password
   ```
   (substituting the `postgres` user's password on the first and second lines.)
 - Run `yarn setup`.

Maybe that's enough, I dunno.
