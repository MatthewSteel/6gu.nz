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

const { pool, query } = require('../src/db');

const environments = ['dev', 'prod', 'stage', 'test'];
if (!(environments.includes(process.env.ENVIRONMENT))) {
  throw new Error('ENVIRONMENT must be dev, prod, stage or test.');
}

const getOrPutUser = (how, authId, next) =>
  query(`
  INSERT INTO users ("providerName", "providerUserId")
  VALUES ($1, $2)
  ON CONFLICT ("providerName", "providerUserId")
    DO UPDATE SET "providerName"=EXCLUDED."providerName"
  RETURNING *;
  `, [how, authId])
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
const providers = process.env === 'prod' ?
  ['google', 'facebook'] :
  ['fake'];


const thisServer = process.env.SERVER_HOST;
const fakeOauthServer = process.env.FAKE_OAUTH_SERVER_HOST_INTERNAL;

const strategies = {
  google: GoogleStrategy,
  facebook: FacebookStrategy,
  fake: FakeOauth2Strategy(fakeOauthServer),
};

providers.forEach((provider) => {
  const Strategy = strategies[provider];
  const PROVIDER = provider.toUpperCase();
  passport.use(new Strategy(
    {
      clientID: process.env[`OAUTH2_${PROVIDER}_CLIENT_ID`],
      clientSecret: process.env[`OAUTH2_${PROVIDER}_CLIENT_SECRET`],
      callbackURL: `${thisServer}/auth/${provider}/callback`,
    },
    (accessToken, refreshToken, profile, cb) =>
      getOrPutUser(provider, profile.id, cb),
  ));
});


const app = express();
app.use(express.json());
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
providers.forEach((provider) => {
  // They send users here after login on their site
  app.get(
    `/auth/${provider}/callback`,
    passport.authenticate(
      provider,
      {
        successRedirect: '/loginSuccess',
        failureRedirect: '/loginFailure',
      },
    ),
  );
});

const appHost = process.env.APP_HOST;
['loginSuccess', 'loginFailure'].forEach((route) => {
  app.get(
    `/${route}`,
    (req, res) => res.send(`
      <html><head><script>
      if (window.opener) {
        window.opener.focus();
        window.opener.postMessage('${route}', '${appHost}');
      }
      window.close();
      </script></head></html>
    `),
  );
});

// TODO: test this...
app.get('/logout', (req, res) => {
  req.logout(); // I think this just drops the session from the db.
  // res.cookie('loggedIn', false);
  res.end();
});

app.get('/userInfo/:docId?', async (req, res) => {
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

app.get('/documents/:documentId', async (req, res) => {
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

app.delete('/documents/:documentId', async (req, res) => {
  if (!req.user) {
    res.status(401);
    res.end();
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
  res.status(404);
  res.end();
});

app.put('/documents/:documentId', async (req, res) => {
  if (!req.user) {
    res.status(401);
    res.end();
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
      res.status(500);
    }
  } else {
    res.status(401);
  }
});

app.listen(3001);
