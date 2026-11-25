const { Client } = require("pg");
const c = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
c.connect()
  .then(async () => {
    const a = await c.query(
      "select tier, count(*)::int n, min(value) mn, max(value) mx, round(avg(value))::int av from cards group by tier order by av",
    );
    const b = await c.query("select tier, count(*)::int n, min(value) mn from cards where set_code='sv3pt5' and value >= 500 group by tier order by mn");
    const o = await c.query("select count(*)::int n from openings");
    const u = await c.query("select count(*)::int n, count(*) filter (where credits > 0)::int funded from users");
    console.log(JSON.stringify(a.rows));
    console.log("sv3pt5 >= 500:", JSON.stringify(b.rows));
    console.log("openings", o.rows[0].n, "users", JSON.stringify(u.rows[0]));
    await c.end();
  })
  .catch((e) => {
    console.log("err", e.message);
    process.exit(1);
  });
