const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:54329/auric' });
  await c.connect();
  const r = await c.query('select count(*)::int n from packs');
  console.log('packs in db:', r.rows[0].n);
  await c.end();
})().catch(e => console.log('db ERR', e.message));
