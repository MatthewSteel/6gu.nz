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

const { pool, query } = require('../src/db');

const environments = ['dev', 'prod', 'stage', 'test'];
if (!(environments.includes(process.env.ENVIRONMENT))) {
  throw new Error('ENVIRONMENT must be dev, prod, stage or test.');
}

const getOrPutUser = (how, authId, next) =>
  query(`
  INSERT INTO users (providerName, providerUserId)
  SELECT $1, $2
  WHERE NOT EXISTS (
    SELECT id FROM users WHERE providerName=$1 AND providerUserId=$2
  );
  SELECT * FROM users WHERE providerName=$1 AND providerUserId=$2;
  `, how, authId)
    .then(res => next(null, res.rows[0]))
    .catch(next);

const getUser = (id, next) =>
  query('SELECT * FROM users WHERE id=$1;')
    .then(res => next(null, res.rows[0]))
    .catch(next);


// Session data
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(getUser);


// Oauth2
const providers = process.env === 'prod' ? ['google', 'facebook'] : [];
const strategies = {
  google: GoogleStrategy,
  facebook: FacebookStrategy,
};

providers.forEach((provider) => {
  const Strategy = strategies[provider];
  const PROVIDER = provider.toUpperCase();
  passport.use(new Strategy(
    {
      clientId: process.env[`OAUTH2_${PROVIDER}_CLIENT_ID`],
      clientSecret: process.env[`OAUTH2_${PROVIDER}_CLIENT_SECRET`],
      callbackUrl: `/auth/${provider}/callback`,
    },
    (accessToken, refreshToken, profile, cb) =>
      getOrPutUser(provider, profile.id, cb),
  ));
});


const app = express();
app.use(session({
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
  // Route to redirect to their login
  app.get(
    `/auth/${provider}`,
    passport.authenticate(provider, { display: 'popup' }),
  );

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
    route,
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

// ??? TODO: test this...
app.get('/logout', (req, res) => {
  req.logout();
  res.cookie('loggedIn', false);
  res.end();
});

app.get('/userInfo', async (req, res) => {
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

app.get('/documents/:documentId', async (req, res) => {
  const results = await query(
    // TODO: access controls
    'SELECT * FROM documents WHERE id=$1;',
    [req.params.documentId],
  );
  res.json(results.rows[0]);
});

app.put('/documents/:documentId', async (req, res) => {
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
