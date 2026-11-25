const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:54329/auric' });
  await c.connect();
  const r = await c.query(`select p.id, p.slug, p.name, p.category, p.description, p.price, p.accent, p.featured, p.free_per_account, p.min_value_note, count(pc.card_id)::int as pool_size, coalesce(min(c.value),0)::int as min_value, coalesce(max(c.value),0)::int as max_value from packs p left join pack_cards pc on pc.pack_id = p.id left join cards c on c.id = pc.card_id where p.active group by p.id order by p.sort_order, p.price`);
  console.log(JSON.stringify(r.rows.map(x=>({slug:x.slug, pool:x.pool_size, price:x.price, max:x.max_value}))));
  const t = await c.query(`select p.slug as pack_slug, c.id, row_number() over (partition by p.id order by c.value desc) as rn from packs p join pack_cards pc on pc.pack_id = p.id join cards c on c.id = pc.card_id where p.active`);
  console.log('top rows', t.rows.length, t.rows[0]);
  await c.end();
})().catch(e => console.log('ERR', e.message));
