-- ============================================================================
-- わんにゃんメモリー — Supabase テーブル定義
-- テーブル自体は 2026-08-04 にダッシュボードで手作りしたが、後から見直せるように
-- ここへ書き起こしてある。何度実行しても壊れない。
--
-- 達人への道／IRON LOG／URUOI／QUEST LIST／買い物メモ と同じプロジェクトに
-- 相乗りしているので、「authenticated に grant / anon から revoke / RLS＋ポリシー」
-- を毎回明示する（自動設定に頼らない構成）。
--
-- ※ SQL Editor は必ずタブの「＋」で新しいクエリを作ってから貼ること
--   （既存の「無題のクエリ」を上書きしてしまわないように）。
-- ============================================================================

-- ── 1) ペット（1匹1行。写真は base64 のまま data に入っている） ──
create table if not exists public.wannyan_pets (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  pet_id     text        not null,
  pet_type   text        not null default 'dog',   -- 'dog' | 'cat'
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, pet_id)
);

create index if not exists wannyan_pets_user_updated_idx
  on public.wannyan_pets (user_id, updated_at asc);

-- ── 2) 病院（全ペット共通） ──
create table if not exists public.wannyan_hospitals (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  hospital_id text        not null,
  data        jsonb       not null default '{}'::jsonb,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, hospital_id)
);

create index if not exists wannyan_hospitals_user_updated_idx
  on public.wannyan_hospitals (user_id, updated_at asc);

-- ── 3) updated_at をサーバー時刻で入れる（2026-08-06 追加） ──
-- 端末の時計で updated_at を入れると、時計がずれた端末の行が
-- 「前回より新しい行だけ取る」差分同期の網から永久に漏れる。
-- PCの時刻同期が切れていると、その端末で編集したペットが
-- iPhone 側にいつまでも届かなくなる。サーバーの now() に統一する。
-- sync.js 側からは updated_at を送らない。
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists wannyan_pets_touch on public.wannyan_pets;
create trigger wannyan_pets_touch before insert or update on public.wannyan_pets
  for each row execute function public.set_updated_at();

drop trigger if exists wannyan_hospitals_touch on public.wannyan_hospitals;
create trigger wannyan_hospitals_touch before insert or update on public.wannyan_hospitals
  for each row execute function public.set_updated_at();

-- ── RLS ──
alter table public.wannyan_pets      enable row level security;
alter table public.wannyan_hospitals enable row level security;

drop policy if exists wannyan_pets_own      on public.wannyan_pets;
drop policy if exists wannyan_hospitals_own on public.wannyan_hospitals;

create policy wannyan_pets_own on public.wannyan_pets
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy wannyan_hospitals_own on public.wannyan_hospitals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 権限（anon は完全に締め出す） ──
revoke all on public.wannyan_pets      from anon;
revoke all on public.wannyan_hospitals from anon;

grant select, insert, update, delete on public.wannyan_pets      to authenticated;
grant select, insert, update, delete on public.wannyan_hospitals to authenticated;

-- ── 確認用（anon で叩くと permission denied になるのが正しい） ──
-- select * from public.wannyan_pets limit 1;
