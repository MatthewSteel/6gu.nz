'use strict';

const express = require('express');
const shortid = require('shortid');

// TODO: Use some "cookie session" lib?
// ALSO FIXME: Put sessions in the db so we can expire them properly...
// Or send them encrypted using that Mozilla thing?
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const FakeOauth2Strategy = require('./fakeOauthServer/fakeStrategy');
const migrate = require('migrate');
const migrationStore = require('./migrationStore');

const { pool, query } = require('../src/db');

const getOrPutUser = (provider, id, next) =>
  // An upsert where the update is a no-op so we can fetch the thing if it
  // exists already. Used for logins and registrations.
  // The first user is automatically an admin, and should (in the future) be
  // able to make other users admins.
  query(`
  INSERT INTO users ("providerName", "providerUserId", "isAdmin")
  VALUES (
    $1,
    $2,
    COALESCE((SELECT FALSE FROM users LIMIT 1), TRUE)
  ) ON CONFLICT ("providerName", "providerUserId")
    DO UPDATE SET "providerName"=EXCLUDED."providerName"
  RETURNING *;
  `, [provider, id])
    .then(res => next(null, res.rows[0]))
    .catch(next);

const getUser = (id, next) =>
  query('SELECT * FROM users WHERE id=$1;', [id])
    .then(res => next(null, res.rows[0]))
    .catch(next);


// Session data
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(getUser);


// Oauth2
const providers = process.env.NODE_ENV === 'production' ?
  ['google', 'facebook'] :
  ['fake'];


const hostWithProtocol = process.env.NODE_ENV === 'production' ?
  `https://${process.env.HOST}` : `http://${process.env.HOST}`;
const serverHost = process.env.NODE_ENV === 'production' ?
  hostWithProtocol : `${hostWithProtocol}:3001`;

const fakeOauthFromServer = 'http://fake_oauth_server:2999';
const fakeOauthFromClient = `${hostWithProtocol}:2999`;

const strategies = {
  google: GoogleStrategy,
  facebook: FacebookStrategy,
  fake: FakeOauth2Strategy(fakeOauthFromServer, fakeOauthFromClient),
};

providers.forEach((provider) => {
  const Strategy = strategies[provider];
  const PROVIDER = provider.toUpperCase();
  passport.use(new Strategy(
    {
      clientID: process.env[`OAUTH2_${PROVIDER}_CLIENT_ID`],
      clientSecret: process.env[`OAUTH2_${PROVIDER}_CLIENT_SECRET`],
      callbackURL: `${serverHost}/auth/${provider}/callback`,
    },
    (accessToken, refreshToken, profile, cb) =>
      getOrPutUser(provider, profile.id, cb),
  ));
});


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  saveUninitialized: true,
  store: new PgSession({ pool }),
  secret: process.env.COOKIE_SECRET,
  resave: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// For the client to know when they're logged in :-)
app.use((req, res, next) => {
  res.cookie('loggedIn', !!req.user);
  next();
});

// ROUTES

// login routes
const authParams = {
  google: { scope: ['openid'] },
  facebook: {},
  fake: {},
}
providers.forEach((provider) => {
  // They send users here after login on their site
  app.get(
    `/api/auth/${provider}/callback`,
    passport.authenticate(
      provider,
      {
        successRedirect: '/api/loginSuccess',
        failureRedirect: '/api/loginFailure',
      },
    ),
  );
  // Our users go here (on our site) in a new tab and we redirect them to a
  // login page.
  app.get(
    `/api/auth/${provider}`,
    passport.authenticate(provider, authParams[provider]),
  );
});


const clientHost = process.env.NODE_ENV === 'production' ?
  hostWithProtocol : `${hostWithProtocol}:3000`;

['loginSuccess', 'loginFailure'].forEach((route) => {
  app.get(
    `/api/${route}`,
    (req, res) => res.send(`
      <html><head><script>
      if (window.opener) {
        window.opener.focus();
        window.opener.postMessage('${route}', '${clientHost}');
      }
      window.close();
      </script></head></html>
    `),
  );
});

app.get('/api/logout', (req, res) => {
  req.logout(); // I think this just drops the session from the db.
  res.end();
});

app.get('/api/userInfo/:docId?', async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const documentResults = await query(
    `SELECT id, metadata, "createdAt", "modifiedAt", "prettyId", "updateId"
     FROM documents WHERE "userId"=$1;`,
    [userId],
  );
  const userResults = await query(
    'SELECT id, "signupAt", metadata FROM users WHERE id=$1;',
    [userId],
  );

  // TODO: Let the user ask for a specific document (id from localStorage)
  // so we can show different documents in different sessions/logins.
  // NOTE: the user may have no documents.
  const recentDocumentResults = await query(
    `SELECT d.*
     FROM documents d
     WHERE
      d.id=(
       SELECT u."lastViewedDocumentId"
       FROM users u WHERE u.id=$1
      )
      OR d."prettyId"=$2
     ORDER BY d."prettyId"=$2 DESC
     LIMIT 1;`
    ,
    [userId, req.params.docId],
  );
  const maybeRecentDocument = recentDocumentResults.rows[0];

  res.json({
    user: userResults.rows[0],
    documents: documentResults.rows,
    maybeRecentDocument,
  });
});

app.get('/api/documents/:documentId', async (req, res) => {
  const id = req.params.documentId;

  const results = await query('SELECT * FROM documents WHERE id=$1', [id]);
  res.json(results.rows[0]);

  if (req.user) {
    query(
      'UPDATE users SET "lastViewedDocumentId"=$1 WHERE id=$2',
      [id, req.user.id],
    );
  }
});

app.delete('/api/documents/:documentId', async (req, res) => {
  if (!req.user) {
    res.status(401).end();
    return;
  }
  const results = await query(
    // TODO: access controls
    'DELETE FROM documents WHERE id=$1 AND "userId"=$2;',
    [req.params.documentId, req.user.id],
  );
  if (results.rowCount) {
    res.end();
    return;
  }
  res.status(404).end();
});

app.put('/api/documents/:documentId', async (req, res) => {
  if (!req.user) {
    res.status(401).end();
    return;
  }
  const existingDocuments = await query(
    'SELECT "userId" FROM documents WHERE id=$1;',
    [req.params.documentId],
  );
  const doc = existingDocuments.rows[0];
  const { updateId, data, metadata } = req.body;

  // Small race conditions here, I don't care.
  if (!doc) {
    const prettyId = shortid.generate();
    const results = await query(
      `INSERT INTO documents as d
        (id, data, "prettyId", "updateId", "userId", metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING d.id, d."prettyId", d.metadata, d."userId";`,
      [req.params.documentId, data, prettyId, updateId, req.user.id, metadata],
    );
    res.json(results.rows[0]);
    query(
      'UPDATE users SET "lastViewedDocumentId"=$1 where id=$2',
      [req.params.documentId, req.user.id],
    );
  } else if (req.user.id === doc.userId) {
    // TODO: compare previous update id so we don't stomp on concurrent
    // edits
    try {
      const maybeDataQuery = data ? 'data=$5, ' : '';
      const maybeDataParam = data ? [data] : [];
      const result = await query(
        `UPDATE documents d SET
           ${maybeDataQuery}
           "updateId"=$2,
           "userId"=$3,
           metadata=$4,
           "modifiedAt"=NOW()
         WHERE id=$1
         RETURNING d.id, d."prettyId", d.metadata, d."userId";`,
        [
          req.params.documentId, updateId, req.user.id, metadata,
          ...maybeDataParam,
        ],
      );
      res.json(result.rows[0]);
      query(
        'UPDATE users SET "lastViewedDocumentId"=$1 where id=$2',
        [req.params.documentId, req.user.id],
      );
    } catch (e) {
      res.status(500).end();
    }
  } else {
    res.status(401).end();
  }
});


app.get('/api/migrations', async (req, res) => {
  const anyUsers = (await query(`SELECT 1 FROM USERS LIMIT 1;`)).rowCount;
  const permitted = (req.user && req.user.isAdmin) || !anyUsers;
  if (!permitted) {
    res.status(403).end();
    return;
  }
  const loadArgs = {
    stateStore: new migrationStore(),
    migrationsDirectory: 'migrations',
  };
  migrate.load(loadArgs, (err, data) => {
    if (err) {
      res.status(500).end();
      return;
    }
    const numRun = data.migrations
      .filter(({ timestamp }) => timestamp).length;

    const rows = data.migrations.map(({ title, timestamp }, i) => {
      const action = (timestamp === null) ? 'up' : 'down';
      const link = (i + 1 === numRun) ?  '' : (`
        <form action="/api/migrate" method="post">
          <input type="text" name="title" />
          <button type="submit">${action}</button>
        </form>
      `);
      return (`
        <tr>
          <td>${title}</td>
          <td>${timestamp ? timestamp : ''}</td>
          <td>${link}</td>
        </tr>
      `);
    });
    res.send((`
      <html><head>
        <style>
          table { border-spacing: 10px; }
          th, td { border-bottom: 1px solid #AAA; padding: 5px; }
        </style>
        <title>Migrations</title>
        </head><body>
        <table>
        <tr><th>Title</th><th>Ran at</th><th>Title again</th></tr>
        ${rows.join('\n')}
        </table>
      </body></html>
    `));
  });
});

app.post('/api/migrate', async (req, res) => {
  const anyUsers = (await query(`SELECT 1 FROM USERS LIMIT 1;`)).rowCount;
  const permitted = (req.user && req.user.isAdmin) || !anyUsers;
  if (!permitted) {
    res.status(403).end();
    return;
  }
  const loadArgs = {
    stateStore: new migrationStore(),
    migrationsDirectory: 'migrations',
  };
  migrate.load(loadArgs, (err, data) => {
    if (err) {
      res.status(500).end();
      return;
    }
    const { migrations } = data;
    const migration = migrations.find(({ title, timestamp }) => (
      title === req.body.title));
    if (!migration) {
      res.status(404).end();
      return;
    }
    const cb = (err) => {
      if (err) {
        res.status(500).end();
      } else {
        res.send('<html><head /><body><a href="/api/migrations">back</a></body></html>');
      }
    };

    req.connection.setTimeout( 1000 * 60 * 10 ); // ten minutes
    if (migration.timestamp) {
      data.down(migration.title, cb);
    } else {
      data.up(migration.title, cb);
    }
  });
});

app.listen(3001);
