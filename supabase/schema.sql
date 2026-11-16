-- Jalankan seluruh isi file ini di Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  role text not null default 'member' check (role in ('admin','member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  work_type text not null check (work_type in ('lining','cat')),
  article text not null,
  component text not null,
  bag_count integer not null check (bag_count > 0),
  unit_price numeric(14,2) null check (unit_price is null or unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true); $$;

create or replace function public.enforce_report_price()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_admin() then
    if tg_op='INSERT' then new.unit_price := null;
    else new.unit_price := old.unit_price; end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists report_price_guard on public.reports;
create trigger report_price_guard before insert or update on public.reports
for each row execute function public.enforce_report_price();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;

drop policy if exists "read own or admin profiles" on public.profiles;
create policy "read own or admin profiles" on public.profiles for select
using (id=auth.uid() or public.is_admin());

drop policy if exists "member update own basic profile" on public.profiles;
create policy "member update own basic profile" on public.profiles for update
using (id=auth.uid() and role='member')
with check (id=auth.uid() and role='member');

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read own or all reports" on public.reports;
create policy "read own or all reports" on public.reports for select
using (created_by=auth.uid() or public.is_admin());

drop policy if exists "members create own reports" on public.reports;
create policy "members create own reports" on public.reports for insert
with check (created_by=auth.uid() or public.is_admin());

drop policy if exists "owner or admin update reports" on public.reports;
create policy "owner or admin update reports" on public.reports for update
using (created_by=auth.uid() or public.is_admin())
with check (created_by=auth.uid() or public.is_admin());

drop policy if exists "owner or admin delete reports" on public.reports;
create policy "owner or admin delete reports" on public.reports for delete
using (created_by=auth.uid() or public.is_admin());

-- Profil dibuat oleh admin setelah membuat user melalui Authentication > Users.
-- PENTING: setelah membuat akun pertama, jadikan admin dengan SQL:
-- update public.profiles set role='admin' where email='EMAIL_ADMIN_ANDA';
-- Jangan pernah memasukkan service_role key ke aplikasi browser.
