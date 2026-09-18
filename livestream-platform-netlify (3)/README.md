# FYC Live Ops Dashboard ⚡

Dashboard operasional untuk monitoring performa livestream TikTok & Shopee: GMV, live hours, host performance, brand contribution, assessment, payroll, reporting, dan data sync.

Master data bawaan berisi **1.798 livestream sessions** dan dapat diganti melalui CSV / Google Sheet sync.

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

> Catatan: PIN ini merupakan **client-side access guard**, bukan server-side authentication. Untuk deployment dengan security requirement tinggi, gunakan Supabase Auth dan RLS authenticated-only.

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
