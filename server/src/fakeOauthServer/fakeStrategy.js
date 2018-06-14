'use strict';

const { OAuth2Strategy } = require('passport-oauth');

module.exports = host => class DerivedStrategy extends OAuth2Strategy {
  constructor(params, userFn) {
    // Expose the same params as the existing provider-specific
    // strategies.
    super(
      {
        ...params,
        authorizationURL: `${host}/oauth2/authorize`,
        tokenURL: `${host}/oauth/token`,
      },
      userFn,
    );
    this.name = 'fake';
  }

  // eslint-disable-next-line class-methods-use-this
  userProfile(accessToken, done) {
    // Would normally make another request for this, I think.
    // Maybe in the future.
    return done(null, { id: 1234 });
  }
};
