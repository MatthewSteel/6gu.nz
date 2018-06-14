'use strict';

const express = require('express');

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
  INSERT INTO users (providerName, providerUserId)
  VALUES ($1, $2)
  ON CONFLICT (providerName, providerUserId)
    DO UPDATE SET providerName=EXCLUDED.providerName
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


// Host is really "this server" but in dev we have to redirect to the
// right port because the dev server proxy only intercepts XHRs etc, not
// navigation.
const host = process.env.OAUTH2_CLIENT_HOST;

const strategies = {
  google: GoogleStrategy,
  facebook: FacebookStrategy,
  fake: FakeOauth2Strategy(host),
};

providers.forEach((provider) => {
  const Strategy = strategies[provider];
  const PROVIDER = provider.toUpperCase();
  passport.use(new Strategy(
    {
      clientID: process.env[`OAUTH2_${PROVIDER}_CLIENT_ID`],
      clientSecret: process.env[`OAUTH2_${PROVIDER}_CLIENT_SECRET`],
      callbackURL: `${host}/auth/${provider}/callback`,
    },
    (accessToken, refreshToken, profile, cb) =>
      getOrPutUser(provider, profile.id, cb),
  ));
});


const app = express();
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

['loginSuccess', 'loginFailure'].forEach((route) => {
  app.get(
    `/${route}`,
    (req, res) => res.send(`
      <html><head><script>
      if (window.opener) {
        window.opener.focus();
        window.opener.postMessage('${route}');
      }
      window.close();
      </script></head></html>
    `),
  );
});

// TODO: test this...
app.get('/api/logout', (req, res) => {
  req.logout(); // I think this just drops the session from the db.
  res.cookie('loggedIn', false);
  res.end();
});

app.get('/api/userInfo', async (req, res) => {
  if (!req.user) {
    res.end();
    return;
  }
  const documentResults = await query(
    `SELECT id, metadata, createdAt, modifiedAt
     FROM documents WHERE userId=$1;`,
    [req.user.id],
  );
  const userResults = await query(
    'SELECT signupAt, metadata FROM users WHERE id=$1',
    [req.user.id],
  );
  res.json({
    user: userResults.rows[0],
    documents: documentResults.rows,
  });
});

app.get('/api/documents/:documentId', async (req, res) => {
  const results = await query(
    // TODO: access controls
    'SELECT * FROM documents WHERE id=$1;',
    [req.params.documentId],
  );
  res.json(results.rows[0]);
});

app.delete('/api/documents/:documentId', async (req, res) => {
  if (!req.user) {
    res.status(401);
    res.end();
    return;
  }
  const results = await query(
    // TODO: access controls
    'DELETE FROM documents WHERE id=$1 AND userId=$2;',
    [req.params.documentId, req.user.id],
  );
  if (results.rows[0]) {
    res.end();
  }
  res.status(404);
  res.end();
});

app.put('/api/documents/:documentId', async (req, res) => {
  if (!req.user) {
    res.status(401);
    res.end();
    return;
  }
  const existingDocuments = await query(
    'SELECT userId FROM documents WHERE id=$1;',
    [req.params.documentId],
  );
  const doc = existingDocuments.rows[0];
  const { nextUpdateId, data, metadata } = req.post();

  // Small race conditions here, I don't care.
  if (!doc) {
    await query(
      `INSERT INTO documents (id, data, updateId, userId, metadata)
       VALUES ($1, $2, $3, $4, $5);`,
      [req.params.documentId, data, nextUpdateId, req.user.id, metadata],
    );
  } else if (req.user.id === doc.userId) {
    // TODO: compare previous update id so we don't stomp on concurrent
    // edits
    await query(
      `UPDATE documents SET
         data=$2, updateId=$3, userId=$4, metadata=$5, modifiedAt=NOW()
       WHERE id=$1;`,
      [req.params.documentId, data, nextUpdateId, req.user.id, metadata],
    );
  } else {
    res.status(401);
  }
  res.end();
});

app.listen(3001);
