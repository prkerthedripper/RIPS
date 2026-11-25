/*
  Starter pack guarantee, tightened.

  Every card in the First Spark pool is an Ultra Rare or Secret Rare from 151,
  so the disclosed $5.00 floor is a property of the pool itself. Because a sale
  pays 85% of collection value, the cheapest possible starter card (700 cents)
  still sells for 595 cents — so a new account that opens the starter pack and
  sells the card always ends at $5.00 or more, without touching the odds.
*/

update packs set
  description = 'One card, guaranteed to be worth at least $5.00 of simulated collection value — and at least $5.00 if you sell it straight away. Every card in this pool is a 151 Ultra Rare or Secret Rare, with the same physical tear and cinematic reveal as the rest of the shelf. One per account.',
  min_value_note = 500
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
     and c.value >= 700
),
counts as (
  select tier, count(*)::numeric as n from pool group by tier
),
probs as (
  select * from (values ('ultra', 0.65), ('secret', 0.35)) as v(tier, p)
)
insert into pack_cards (pack_id, card_id, weight)
select s.id, pool.id, (probs.p / counts.n)::double precision
  from pool
  join counts on counts.tier = pool.tier
  join probs on probs.tier = pool.tier
 cross join starter s;
