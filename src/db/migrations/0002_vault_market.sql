-- Virtual USD, vault/sell lifecycle, and card market references.
--
-- `credits` keeps its column name but is now an integer number of CENTS of
-- simulated virtual USD. 5000 -> $50.00, 300 -> $3.00. Integer cents avoid
-- floating point drift in every balance and transaction row.

alter table users alter column credits set default 0;

alter table cards add column if not exists market_cents integer
  check (market_cents is null or market_cents >= 0);
alter table cards add column if not exists market_currency text not null default 'USD';
alter table cards add column if not exists market_source text not null default '';
alter table cards add column if not exists market_updated_at timestamptz;

alter table openings add column if not exists status text not null default 'pending';
alter table openings drop constraint if exists openings_status_check;
alter table openings add constraint openings_status_check
  check (status in ('pending', 'vaulted', 'sold'));
alter table openings add column if not exists sold_cents integer
  check (sold_cents is null or sold_cents >= 0);
alter table openings add column if not exists decided_at timestamptz;
create index if not exists openings_user_status_idx
  on openings (user_id, status, created_at desc);

alter table credit_transactions drop constraint if exists credit_transactions_kind_check;
alter table credit_transactions add constraint credit_transactions_kind_check
  check (kind in ('signup', 'pack_open', 'daily', 'starter', 'admin_adjust', 'sale', 'refund'));

-- Historic openings were awarded straight into the binder.
update openings set status = 'vaulted', decided_at = created_at where status = 'pending';

insert into settings (key, value) values ('signup_credits', '0')
  on conflict (key) do update set value = excluded.value;

-- Starter pack: a curated, disclosed 151 pool of Ultra Rares and Secret Rares
-- where every card is worth at least $5.00, so the guaranteed minimum is a
-- property of the pool and not a hidden adjustment to the odds.
update packs set
  name = 'First Spark',
  category = 'free',
  price = 0,
  free_per_account = true,
  min_value_note = 500,
  description = 'One card, guaranteed to be worth at least $5.00 of simulated collection value. Every card in this pack is a 151 Ultra Rare or Secret Rare — the same physical tear and cinematic reveal as the rest of the shelf. One per account.',
  sort_order = 10
 where slug = 'first-spark';

delete from pack_cards where pack_id = (select id from packs where slug = 'first-spark');

with starter as (
  select id from packs where slug = 'first-spark'
),
pool as (
  select c.id, c.tier
    from cards c
   where c.set_code = 'sv3pt5'
     and c.tier in ('ultra', 'secret')
     and c.value >= 500
),
counts as (
  select tier, count(*)::numeric as n from pool group by tier
),
probs as (
  select * from (values ('rare', 0.05), ('ultra', 0.62), ('secret', 0.33)) as v(tier, p)
)
insert into pack_cards (pack_id, card_id, weight)
select s.id, pool.id, (probs.p / counts.n)::double precision
  from pool
  join counts on counts.tier = pool.tier
  join probs on probs.tier = pool.tier
 cross join starter s;
