# FYC Livestream Performance Intelligence Platform ⚡

Platform analitik livestreaming enterprise dengan tampilan modern minimalis ala **Apple Design System**, dirancang khusus untuk Head of Livestreaming, Lead Live Operations, Tim Evaluator, Tim Finance, dan Brand Pitching.

Platform ini terhubung ke master data spreadsheet:
`1mPTvujucuvcoQlnEticjy1QDhiYoguHqk89_ylj44o8` (Tab: `Report`).

---

## 📌 Jawaban Pertanyaan & Fitur Baru

### 1. Cara Hapus Sub-Account
- Buka **Sub-Accounts Switcher** (klik tombol profil di kanan atas topbar atau di footer sidebar), lalu klik ikon **✕** merah di samping sub-account yang ingin dihapus.
- Atau buka menu baru **Admin Control Panel > Sub-Accounts & PINs**, lalu klik tombol **🗑️** pada akun yang ingin dihapus.
- *Catatan:* Akun Super Admin utama (`Afiq Mazadi`) terlindungi dari penghapusan tidak sengaja.

### 2. Dimana Sub-Account Tersimpan? (Cloud vs LocalStorage)
- **Saat ini:** Sebagai *Static Web Application* di Netlify, seluruh data sub-account, password/PIN, penilaian, dan rate card tersimpan di **Browser LocalStorage** perangkat Anda.
- **Kelebihan:** Super cepat, bekerja 100% offline, gratis tanpa biaya server/database.
- **Fitur Baru - Backup & Portabilitas:** Di menu **Admin Control Panel > Cloud & Storage Info**, tersedia tombol **"Download Data Backup (JSON)"** dan **"Restore Data Backup"** sehingga Anda bisa memindahkan seluruh data antar komputer dengan sekali klik.
- **Opsi Cloud Terpusat:** Di tab yang sama tersedia panduan menghubungkan Google Apps Script Web App langsung ke spreadsheet master untuk sinkronisasi otomatis multi-perangkat.

### 3. Fitur Filter Tanggal (Start Date + End Date)
- Di bagian topbar, pada dropdown tanggal pilih opsi **"Custom Date Range..."**.
- Dua input tanggal bergaya Apple (**Start Date** dan **End Date**) akan muncul secara otomatis.
- Mengubah tanggal mulai atau tanggal akhir akan langsung menyaring seluruh 1.798 data live shifts, grafik GMV harian, perbandingan platform, dan raport host secara real-time.

### 4. Admin Control Panel (Rate Host, Sub-Account, Password/PIN)
Menu baru di sidebar: **Admin Control Panel**:
- **Host Rate Cards Master**: Kelola tarif per jam (*hourly rate*) untuk seluruh 15 host, simpan alasan kenaikan tarif (*rate adjustment audit trail*), dan pantau estimasi total payout.
- **Sub-Accounts & Security**:
  - Kelola hak akses: Evaluator (*Can Grade*), Finance (*Can Verify Payroll*), Rates (*Can Manage Rates*), dan Admin.
  - Atur **Password/PIN** (default: `1234`) untuk masing-masing akun penilai sehingga akun evaluator terlindungi saat berganti pengguna.
  - Tombol *Show/Hide PIN* untuk melihat PIN yang terpasang.
  - Tambah anggota tim penilai baru dengan hak akses dan warna avatar khusus.
- **Cloud & Backup Center**: Backup data JSON satu klik dan panduan sinkronisasi multi-device.

---

## 🚀 Cara Deploy Pembaruan ke Netlify

1. Unduh file `livestream-platform-netlify.zip`.
2. Buka dashboard situs Anda di [Netlify Drop](https://app.netlify.com/drop) (atau menu **Deploys** di dashboard Netlify situs Anda).
3. Tarik (*drag & drop*) file ZIP baru tersebut ke area upload Netlify.
4. Situs langsung terbarui dengan seluruh fitur admin dan filter tanggal aktif.
