-- Esquema para SistemaIA - Gastos personales
-- Ejecutar en el SQL Editor de Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  icon text default '📦',
  color text default '#6366f1',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text check (payment_method in ('TDC','EFECTIVO','TDEBITO','TRANSFERENCIA')),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_user_date on public.expenses(user_id, expense_date desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  alert_threshold int not null default 80 check (alert_threshold between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('budget_threshold','large_expense','monthly_total')),
  threshold numeric(12,2) not null check (threshold > 0),
  category_id uuid references public.categories(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

-- Caja de ahorro con rendimiento anual del 10% (capitalización mensual)
create table if not exists public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  annual_rate numeric(5,2) not null default 10 check (annual_rate >= 0 and annual_rate <= 100),
  last_accrual date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid not null references public.savings_accounts(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal','interest')),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_savings_tx_user on public.savings_transactions(user_id, created_at desc);

-- RLS: el backend usa service role (bypassa RLS). Si expones el front directo a
-- Supabase con anon key, habilita RLS y políticas por auth.uid(). Aquí la API
-- es la única que toca la DB, así que las tablas quedan cerradas al exterior.
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.alert_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.savings_transactions enable row level security;

-- Migraciones para bases ya existentes
alter table public.expenses add column if not exists payment_method text;
alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check
  check (payment_method in ('TDC','EFECTIVO','TDEBITO','TRANSFERENCIA'));

-- Seed de categorías por defecto al crear usuario (opcional, lo hace el front)
