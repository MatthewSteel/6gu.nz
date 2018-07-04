'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const OauthServer = require('express-oauth-server');

// Create an Express application.
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const serverHost = process.env.NODE_ENV === 'production' ?
  `https://${process.env.HOST}` : `http://${process.env.HOST}:3001`;

const callbackUrl = `${serverHost}/api/auth/fake/callback`;
const model = {
  getClient() {
    return {
      id: 'asdf',
      clientId: 'asdf',
      clientSecret: 'qwer',
      grants: ['authorization_code', 'password'],
      redirectUris: [callbackUrl],
    };
  },

  getUser() {
    return { id: 'id' };
  },

  tokens: [],

  getAccessToken(bearerToken) {
    return this.tokens.find(token => token.accessToken === bearerToken) || false;
  },

  getRefreshToken(bearerToken) {
    return this.tokens.find(token => token.refreshToken === bearerToken) || false;
  },

  saveToken(token, client, user) {
    this.tokens.push({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      client,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      user,
    });
    return this.tokens[this.tokens.length - 1];
  },

  authCodes: [],

  saveAuthorizationCode(code, client, user) {
    this.authCodes.push({
      authorizationCode: code.authorizationCode,
      expiresAt: code.expiresAt,
      redirectUri: client.redirectUri,
      client,
      user,
    });
    return this.authCodes[this.authCodes.length - 1];
  },

  getAuthorizationCode(authCode) {
    return this.authCodes.find(({ authorizationCode }) => (
      authorizationCode === authCode)) || false;
  },

  revokeAuthorizationCode(authCode) {
    this.authCodes = this.authCodes.filter(({ authorizationCode }) => (
      authorizationCode !== authCode));
    return true;
  },
};

app.oauth = new OauthServer({ model });

// Post token.
app.post('/oauth/token', app.oauth.token());

app.get('/oauth/authorize', (req, res) => (
  res.send(`
    <html><head></head><body>
    <form action="/oauth/authorize" method="post">
      <input type="hidden" id="foo" name="client_id" value="asdf" />
      <input type="hidden" id="bar" name="client_secret" value="qwer" />
      <input type="hidden" id="baz" name="redirect_uri" value="${callbackUrl}" />
      <input type="hidden" id="quux" name="response_type" value="code" />
      <input type="hidden" id="fred" name="state" value="1234" />
      <button type="submit" name="username" value="name">Login</button>
      <button type="submit" name="username" value="fail">Deny</button>
    </form>
    </body></html>
  `)));

app.post('/oauth/authorize', (req, res) => {
  if (req.body.username === 'fail') {
    const path = [
      `${req.body.redirect_uri}`,
      '?error=access_denied',
      '&error_description=hi',
      `&state=${req.body.state}`,
    ].join('');
    return res.redirect(path);
  }
  const options = {
    authenticateHandler: {
      handle: () => model.getUser(),
    },
  };
  return app.oauth.authorize(options)(req, res);
});

app.listen(2999);
