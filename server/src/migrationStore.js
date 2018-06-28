const { query } = require('../src/db');

module.exports = class DbStore {
  load(cb) {
    query('SELECT state FROM public.migrations;', (err, res) => {
      if (err) cb(err);
      cb(null, res.rows[0].state);
    });
  }

  save(data, cb) {
    query('UPDATE public.migrations SET state=$1;', [data], cb);
  }
};
