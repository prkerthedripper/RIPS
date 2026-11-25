const { Client } = require("pg");
const c = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
c.connect()
  .then(async () => {
    const mig = await c.query("select name from schema_migrations order by id");
    const st = await c.query(
      "select count(*)::int n, min(c.value) mn, max(c.value) mx from pack_cards pc join packs p on p.id=pc.pack_id join cards c on c.id=pc.card_id where p.slug='first-spark'",
    );
    const set = await c.query("select value from settings where key='signup_credits'");
    const dr = await c.query("select day_index, credits from daily_rewards order by day_index limit 3");
    const pk = await c.query("select slug, price, min_value_note, free_per_account from packs order by sort_order");
    const mp = await c.query("select count(*)::int total, count(market_cents)::int priced, min(market_cents) mn, max(market_cents) mx from cards");
    const cols = await c.query(
      "select column_name from information_schema.columns where table_name='openings' order by ordinal_position",
    );
    console.log("migrations:", mig.rows.map((r) => r.name).join(", "));
    console.log("starter pool:", JSON.stringify(st.rows[0]));
    console.log("signup_credits:", set.rows[0].value);
    console.log("daily:", JSON.stringify(dr.rows));
    console.log("packs:", JSON.stringify(pk.rows));
    console.log("market:", JSON.stringify(mp.rows[0]));
    console.log("openings cols:", cols.rows.map((r) => r.column_name).join(","));
    await c.end();
  })
  .catch((e) => {
    console.log("err", e.message);
    process.exit(1);
  });
