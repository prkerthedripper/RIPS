const EmbeddedPostgres = require('embedded-postgres').default ?? require('embedded-postgres');
(async () => {
  const pg = new EmbeddedPostgres({
    databaseDir: 'C:/Users/ajube/.zcode/workspace/draft-c94f167a-6838-4406-8b33-ae47bb564bfb/.pgdata',
    port: 54329, user: 'postgres', password: 'postgres', persistent: true,
    onLog: () => {}, onError: (m) => console.error('[pg]', m),
  });
  await pg.start();
  console.log('started');
  setInterval(() => {}, 1 << 30);
})().catch((e) => { console.error(e); process.exit(1); });
