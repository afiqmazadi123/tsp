# FYC Live Ops Dashboard ⚡

## Secure Login & Private Session Data

Production access now uses a mandatory Supabase Auth gate.

- The dashboard does **not initialize** before authentication succeeds.
- A valid Supabase Auth user must also be mapped to `sub_accounts.auth_user_id`.
- Unmapped authenticated users are denied workspace access.
- The 1,798 livestream session rows live in the RLS-protected `public.livestream_sessions` table.
- The deploy no longer includes `data/sessions.json`.
- Private session data is not persisted to browser LocalStorage.
- CSV / Google Sheet imports are written back to Supabase and require Admin permission.
- Signing out clears the in-memory session dataset and authentication session.

### First Admin setup

Before deploying the secure-login build:

1. Open Supabase Dashboard → Authentication → Users.
2. Create the first Admin user using the official Supabase Auth UI.
3. Copy that user's UUID.
4. Map it to the seeded Admin dashboard account:

```sql
UPDATE public.sub_accounts
SET auth_user_id = '<AUTH_USER_UUID>'
WHERE id = 'acc_afiq';
```

5. Confirm the mapping:

```sql
SELECT id, name, auth_user_id
FROM public.sub_accounts
WHERE id = 'acc_afiq';
```

After this mapping exists, the secure-login frontend can be deployed safely.

> Do not create users by manually inserting rows into `auth.users`. Use Supabase Authentication so password hashes, identities, confirmation state, and auth metadata are managed correctly.

---


Dashboard operasional untuk monitoring performa livestream TikTok & Shopee: GMV, live hours, host performance, brand contribution, assessment, payroll, reporting, dan data sync.

Master data bawaan berisi **1.798 livestream sessions** dan dapat diganti melalui CSV / Google Sheet sync.

---

## Phase 3 Production Polish

Phase 3 menambahkan lapisan UX dan reliability untuk deployment production:

- **0 inline `onclick`** pada runtime utama; action dinamis memakai delegated event router.
- Session Master Log sekarang mendukung **sorting per kolom**, search dengan debounce, keyboard sorting, pilihan **15/30/50/100 rows**, dan pagination state yang lebih stabil.
- Table statis di Operations/Admin dapat di-sort langsung dari header.
- Toast notification menggantikan browser `alert()` untuk feedback non-destructive.
- Destructive actions memakai in-app confirmation dialog, bukan browser `confirm()`.
- Cloud/Google Sheet sync menampilkan busy state.
- Setiap view punya error boundary sehingga satu view gagal tidak membuat seluruh dashboard blank.
- Loading awal menggunakan skeleton state.
- Repeated inline layout styles dipindah ke reusable component classes.
- Netlify mendapat CSP, HSTS, anti-frame, permission policy, dan cache revalidation.
- Optional **Supabase Auth runtime** sudah tersedia. Jika signed in, database request otomatis menggunakan JWT user.
- Secure authenticated-only RLS migration tersedia di `security/supabase-auth-rls.sql`.

Secure Auth **tidak dipaksa aktif** agar deployment existing tetap kompatibel. Ikuti `security/README.md` setelah Auth users sudah diprovision dan dipetakan ke `sub_accounts.auth_user_id`.

---

## Phase 2 Architecture

Aplikasi tetap berupa static web app yang ringan, tetapi runtime sekarang dipisah per domain agar lebih mudah dirawat:

- `js/app.js` — core boot, navigation, filter, theme, dan view dispatcher.
- `js/modules/views-dashboard.js` — Dashboard, Live Analytics, Hosts, Brands.
- `js/modules/views-operations.js` — Payroll, Assessment, Reports.
- `js/modules/views-admin.js` — Admin dan Settings.
- `js/modules/accounts-ui.js` — account switcher dan account management UI.
- `js/modules/interactions.js` — drawer, modal, import/export, review actions.
- `js/store.js` — memoized derived-data store agar agregasi tidak dihitung ulang untuk setiap view.
- `js/permissions.js` — capability guard berdasarkan sub-account aktif.
- `js/ui-events.js` — delegated event handler untuk area Account/Admin.
- `js/enhancements.js` — dashboard UX enhancement layer.

Dataset besar tidak lagi ditanam di bundle JavaScript utama. Data session dipindahkan ke `data/sessions.json` dan dimuat asynchronous melalui `js/data-loader.js`, sehingga browser tidak perlu parse ratusan KB object literal sebelum aplikasi mulai boot.

---

## Dashboard & Filter

Dashboard menyediakan:

- Quick range **All / 7D / 30D / Month**.
- Custom start/end date berdasarkan tanggal yang benar-benar tersedia di dataset.
- KPI comparison terhadap periode sebelumnya.
- Interactive GMV trend tooltip.
- Top host, leading brand, most efficient platform, dan peak GMV day.
- Brand legend yang dapat diklik untuk langsung memfilter data.
- Empty state + reset filter jika kombinasi filter tidak menghasilkan session.

Perhitungan `Last 7 Days` dan `Last 30 Days` sudah menggunakan jumlah hari inklusif yang benar dan tidak lagi bergantung pada tanggal hardcoded.

---

## Sub-Accounts & PIN

Sub-account mendukung capability berikut:

- Grade / review host.
- Manage host rates.
- Approve payroll.
- Edit scoring weights.
- Manage accounts & cloud configuration.

PIN yang disimpan di browser/cloud **tidak lagi disimpan sebagai plaintext**. PIN diproses menggunakan **PBKDF2-SHA-256 + random salt** sebelum disimpan. Data PIN lama yang masih plaintext akan dimigrasikan ke format hash saat aplikasi dibuka.

Admin tidak dapat melihat PIN existing. Untuk mengganti PIN, buka Edit Account lalu masukkan PIN baru.

> Catatan: PIN tetap merupakan **client-side access guard**. Phase 3 sudah menyediakan optional Supabase Auth runtime dan authenticated-only RLS migration untuk authorization server-side.

---

## Local Storage & Cloud Sync

Secara default configuration seperti sub-account, assessment, rate card, scoring weight, dan payroll status tersimpan di browser LocalStorage.

Supabase dapat digunakan untuk sinkronisasi antar perangkat. Cloud request sekarang memvalidasi HTTP status sehingga dashboard tidak lagi melaporkan sync berhasil ketika server sebenarnya mengembalikan error.

Menu Admin menyediakan:

- Pull latest cloud data.
- Push local state.
- JSON backup.
- JSON restore.
- SQL setup script.

Anon key Supabase bersifat public by design. Keamanan database harus ditentukan oleh Row Level Security (RLS), bukan dengan menyembunyikan anon key.

Untuk Secure Auth mode:

1. Provision user di Supabase Authentication.
2. Map Auth UUID ke `sub_accounts.auth_user_id`.
3. Sign in melalui **Admin → Cloud & Storage → Secure Supabase Auth**.
4. Setelah minimal satu Admin berhasil login, jalankan `security/supabase-auth-rls.sql`.
5. Setelah secure RLS aktif, anon database write akan ditolak dan permission server-side mengikuti field capability account.

---

## Menjalankan Secara Lokal

Karena dataset utama sekarang dimuat menggunakan `fetch()`, jangan membuka `index.html` langsung menggunakan `file://`.

Jalankan folder melalui local web server, contohnya:

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

---

## Deploy ke Netlify

Folder publish adalah root project ini (`publish = "."`).

Setelah deploy baru, JS/CSS/data menggunakan `must-revalidate` supaya browser tidak tertahan pada bundle lama. Sebelumnya JS/CSS menggunakan cache immutable satu tahun walaupun filename tidak memiliki content hash, yang dapat menyebabkan user tetap melihat versi website lama setelah deploy.

---

## Master Spreadsheet

Google Sheet ID default:

`1mPTvujucuvcoQlnEticjy1QDhiYoguHqk89_ylj44o8`

Target tab:

`Report`
