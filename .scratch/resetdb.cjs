const EmbeddedPostgres = require('embedded-postgres').default ?? require('embedded-postgres');
const fs = require('fs');
(async () => {
  const dir = 'C:/Users/ajube/.zcode/workspace/draft-c94f167a-6838-4406-8b33-ae47bb564bfb/.pgdata';
  const { Client } = require('pg');
  // create the database with an explicit UTF8 encoding
  const admin = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:54329/postgres' });
  await admin.connect();
  await admin.query('drop database if exists auric');
  await admin.query(`create database auric with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'`);
  const r = await admin.query('select datname, pg_encoding_to_char(encoding) enc from pg_database');
  console.log(JSON.stringify(r.rows));
  await admin.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
