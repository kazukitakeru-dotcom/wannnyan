# わんにゃんメモリー — 開発メモ

犬・猫の記録PWA。GitHub Pages で配信する**静的サイト（ビルド無し・依存パッケージ無し）**。
iPhone のホーム画面に追加して使う前提。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 全画面のマークアップ |
| `app.js` | 全ロジック（約240KB・分割していない） |
| `breeds.js` | 犬種・猫種データ |
| `style.css` | スタイル |
| `obsidian.js` | Obsidian用 Markdown 書き出し（ZIP生成も自前実装） |
| `sync.js` | Supabase による複数端末同期 |
| `sw.js` | Service Worker |

**外部ライブラリは一切使わない。** オフラインで完結させるため、CDN 読み込みを増やさないこと。
ZIP生成もSupabaseクライアントも fetch と自前実装で済ませてある。

## データモデル

IndexedDB `wannyan_db` の `keyval` ストア。キーは2つだけ:

- `wannyan_v2` — ペット本体 `{ dog: [...], cat: [...] }`
- `wannyan_hospitals_v1` — 病院（全ペット共通）

**写真は base64 JPEG（長辺800px・品質0.72）を pet オブジェクトに直接埋め込んでいる。**
Storage に分離していないのは、`pet.photo` をデータURL前提で読む箇所がアプリ全体に散っており、
改修コストに対して実データ量（多く見ても数十MB）が小さいため。

localStorage は補助的な用途のみ（並び順、散歩タイマー、`wannyan_pending_notes_v1` など）。

## 変更時に必ず守ること

### 1. `sw.js` の `CACHE_NAME` をバンプする

これを忘れると端末に古いキャッシュが残り、変更が反映されない。**新しいJS/CSSを追加したら
`ASSETS` 配列にも足すこと。**

### 2. ローカル検証の手順

```bash
python -m http.server 8787
```

`file://` では Service Worker が動かないので必ず localhost で開く。
検証中も Service Worker が古いコードを掴むので、リロード前に:

```js
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
(await caches.keys()).forEach(k => caches.delete(k));
```

**localhost は本番と別オリジンなので、実データには影響しない。**テストデータを入れても安全。

## Supabase（同期基盤）

- Project URL: `https://kafaarlosuvqxxlxpvgg.supabase.co`
- Publishable key: `sb_publishable_nSwOQo-YbEtDN_KTjBf80w_D6o0iLoA`
- リージョン: 東京 `ap-northeast-1` / Free プラン

publishable key は**公開前提**の鍵で、静的サイトのソースに出て問題ない。守っているのは鍵ではなく RLS。

### 絶対にやらないこと

- **secret key（`sb_secret_...` / `service_role`）と DB パスワードをコードやドキュメントに書かない。**
  これらはRLSを迂回できる。チャットに貼るのも不可。
- 誤って露出した場合は Settings → API Keys から即ローテーションする。

### このプロジェクトは複数アプリの相乗り前提

Free プランはプロジェクト2つまでなので、別の自作アプリも同じプロジェクトに同居させる。
テーブル名は `wannyan_` のようにアプリ別プレフィックスで分ける。

**新しいテーブルを足すときは毎回この4点をSQLで明示的にやること。**
プロジェクト作成時の自動設定に頼らない構成にしてある:

```sql
alter table public.<表> enable row level security;

create policy "own rows" on public.<表>
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.<表> to authenticated;
revoke all on public.<表> from anon;   -- 既定で TRUNCATE 等が付くことがある
```

検証は「anon で読めないこと」を実際に確認する:

```sql
begin; set local role anon; select count(*) from public.<表>; rollback;
-- ERROR: 42501 permission denied が出れば正しい
```

### 現在のテーブル

- `wannyan_pets` — `(user_id, pet_id)` 主キー、`pet_type`、`data jsonb`、`updated_at`、`deleted`
- `wannyan_hospitals` — `(user_id, hospital_id)` 主キー、`data jsonb`、`updated_at`、`deleted`

## sync.js を他のアプリに流用する

9割は汎用コード。差し替えるのは以下だけ:

1. `SB_URL` / `SB_KEY` — 同じプロジェクトなら変更不要
2. テーブル名（`wannyan_pets` / `wannyan_hospitals`）
3. IndexedDB のキー名（`wannyan_v2` / `wannyan_hospitals_v1`）
4. `installHooks()` でラップする保存関数名

**設計方針**: 既存コードを一切改造せず、保存関数を差し替えるラッパー方式にしてある。
`window.saveData` を上書きすると、classic script なので既存の全呼び出しがラッパーを通る。
同期はペット単位の last-write-wins。変更検出はJSONのハッシュ比較で、変わったレコードだけ送る。
オフライン時は保存だけ通し、`online` / `visibilitychange` で再送する。

ログインはメール＋パスワード。**マジックリンクは使わない** — iOSのホーム画面アプリだと
リンクがSafariで開いてPWA側にセッションが入らず詰む。

## プライバシー設計上の注意

- ログアウト状態でも全機能が動き、その場合データは端末内のみ（同期以前と同じ挙動）
- 別アカウント同士は RLS で完全に分離される
- **ただしプロジェクト管理者はダッシュボードのSQL Editorから全ユーザーの行を読める**（`postgres` 権限はRLSを迂回する）。
  他人に使わせる場合、この点をアプリ内の分離と混同しないこと
- アカウントを増やす予定がないなら、Authentication の設定で**新規登録を無効化**しておく
