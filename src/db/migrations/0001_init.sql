-- AURIC initial schema (real Pokémon TCG data via pokemontcg.io)

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  password_hash text not null,
  avatar        text not null default 'a1',
  bio           text not null default '',
  credits       integer not null default 5000 check (credits >= 0),
  is_admin      boolean not null default false,
  daily_streak  integer not null default 0,
  starter_claimed boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists users_username_lower_idx on users (lower(username));

create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text not null default ''
);
create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists packs (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  category       text not null
                 check (category in ('free','starter','standard','premium','legendary','special')),
  description    text not null default '',
  price          integer not null check (price >= 0),
  accent         text not null default '#ba4bff',
  active         boolean not null default true,
  featured       boolean not null default false,
  featured_rank  integer,
  free_per_account boolean not null default false,
  min_value_note integer,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists packs_category_idx on packs (category);
create index if not exists packs_active_idx on packs (active, sort_order);

create table if not exists cards (
  id        text primary key,            -- Pokémon TCG API id, e.g. sv3pt5-199
  name      text not null,
  set_code  text not null,
  set_name  text not null,
  number    text not null,
  rarity    text not null,               -- real TCG rarity label
  tier      text not null check (tier in ('common','uncommon','rare','ultra','secret')),
  value     integer not null check (value >= 0),
  image     text not null default '',
  thumb     text not null default '',
  artist    text,
  created_at timestamptz not null default now()
);
create index if not exists cards_tier_idx on cards (tier);
create index if not exists cards_set_idx on cards (set_code, number);

create table if not exists pack_cards (
  pack_id  uuid not null references packs (id) on delete cascade,
  card_id  text not null references cards (id) on delete cascade,
  weight   double precision not null check (weight > 0),
  primary key (pack_id, card_id)
);
create index if not exists pack_cards_card_idx on pack_cards (card_id);

create table if not exists openings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  pack_id       uuid not null references packs (id),
  card_id       text not null references cards (id),
  cost          integer not null check (cost >= 0),
  balance_after integer not null,
  created_at    timestamptz not null default now()
);
create index if not exists openings_user_time_idx on openings (user_id, created_at desc);
create index if not exists openings_time_idx on openings (created_at desc);

create table if not exists credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  amount        integer not null,
  kind          text not null
                check (kind in ('signup','pack_open','daily','starter','admin_adjust')),
  ref           text not null default '',
  balance_after integer not null,
  created_at    timestamptz not null default now()
);
create index if not exists credit_tx_user_time_idx on credit_transactions (user_id, created_at desc);

create table if not exists daily_rewards (
  day_index integer primary key check (day_index between 1 and 14),
  credits   integer not null check (credits >= 0),
  item      text not null default ''
);

create table if not exists daily_claims (
  user_id    uuid not null references users (id) on delete cascade,
  claim_date date not null,
  day_index  integer not null,
  credits    integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

create table if not exists settings (
  key   text primary key,
  value text not null
);
