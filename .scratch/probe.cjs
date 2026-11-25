const {Client}=require('pg');
(async()=>{
 const c=new Client({connectionString:'postgres://postgres:postgres@127.0.0.1:54329/auric'});
 await c.connect();
 for (const q of ['show client_encoding','show lc_ctype','show server_encoding','select datname, pg_encoding_to_char(encoding) enc, datcollate from pg_database','select count(*)::int n from cards','select count(*)::int n from packs','select count(*)::int n from users']) {
   try { const r=await c.query(q); console.log(q, '=>', JSON.stringify(r.rows)); } catch(e){ console.log(q,'ERR',e.message);} }
 await c.end();
})().catch(e=>console.log('ERR',e.message));
