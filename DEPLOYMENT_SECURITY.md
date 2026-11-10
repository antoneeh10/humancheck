# HumanCheck - Deployment & Security Documentation

Dokumen ini berisi penjelasan komprehensif mengenai **Prosedur Deployment** dan **Tata Cara Kerja Keamanan** pada sistem CAPTCHA alternatif HumanCheck.

---

## 🚀 1. DOKUMENTASI DEPLOYMENT (Penyebaran)

HumanCheck didesain dengan konsep **Full-Stack SPA + API Proxy Server** menggunakan kombinasi **Node.js + Express** dan **Vite (React + TypeScript)**. Aplikasi siap dideploy ke platform container modern seperti Google Cloud Run, Heroku, AWS ECS, VPS, maupun hosting Node lainnya.

### A. Persiapan Environment (.env)
Buat file `.env` produksi dengan konfigurasi berikut:
```env
# Port & Interface binding (HumanCheck default port: 3000)
PORT=3000

# Kunci rahasia global untuk penandatanganan token HMAC-SHA256
SYSTEM_SECRET="hc_system_sec_misterius_dan_panjang_998877"

# Mode Produksi
NODE_ENV="production"
```

### B. Langkah Kompilasi Lokal & Server
1. **Instalasi Dependensi**: Run `npm install` untuk menginstal seluruh packages.
2. **Kompilasi Kode (Build)**:
   ```bash
   npm run build
   ```
   *Proses ini akan menjalankan dua hal: mengompilasi Frontend SPA ke direktori `/dist` dan membundel backend `server.ts` menjadi file Node CommonJS tunggal `/dist/server.cjs` menggunakan esbuild.*
3. **Menjalankan Server Produksi**:
   ```bash
   npm start
   ```

### C. Deployment Menggunakan Docker (Google Cloud Run / Kubernetes)
Gunakan konfigurasi `Dockerfile` berikut untuk deployment instan:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
```

---

## 🔒 2. DOKUMENTASI KEAMANAN (Security Mechanisms)

HumanCheck dibangun dengan fondasi privasi tinggi ("privacy-by-design") yang dikombinasikan dengan pembatasan anti-bot berlapis tanpa sedikitpun menginterfensi data pribadi atau menanam pelacak iklan pihak ketiga.

### A. Analisis Perilaku Realtime (Behavior Heuristics)
Deteksi bot dilakukan melalui empat parameter dinamis di sisi klien yang di-validasi ulang di sisi server:
1. **Dinamika Kursor Mouse (Desktop)**:
   * **Curvature (Kelengkungan Lintasan)**: Membandingkan posisi mouse (`x`, `y`) untuk mendeteksi apakah rute berbentuk garis lurus sempurna (linear) yang dicirikan oleh script automasi komputer. Gerakan tangan manusia selalu memiliki variasi kelengkungan/bengkok (splines).
   * **Speed Variance**: Mengukur akselerasi dan deselerasi kursor. Gerak manual manusia memiliki kecepatan naik turun (akselerasi di tengah, deselerasi mendekati checkbox). Bot biasanya bergerak konstan.
   * **Direction Jitters**: Mendeteksi jika terdapat koreksi posisi manual (jitter micro-shakes) yang wajar pada tangan manusia.
2. **Screen Timing Metrics**:
   * Evaluasi waktu reaksi semenjak widget termuat hingga checkbox diklik. Klik dengan rentang waktu di bawah 400 milidetik langsung didegradasi skornya karena melebihi batasan sistem motorik manusia tercepat.
3. **Sensorik Mobile Touch Event**:
   * Mengintegrasikan pendeteksi sapuan jari (`swipe velocity`), sensor multi-touch, koordinat penekanan jari, dan penolakan emulator otomatis.
4. **Window Focus Environment**:
   * Memastikan window browser berada dalam kondisi aktif/focus guna menangkal bot headless (seperti Puppeteer/Selenium) yang merender widget secara latar belakang (background headless execution).

### B. Verifikasi Token HMAC SHA256 (Anti-Counterfeiting)
Mencegah pembuatan token valid buatan lokal secara ilegal:
* Token dikonstruksi dari payload JSON: `siteKey`, `score`, `hostname`, `timestamp`, `ip`, dan `nonce`.
* Payload di-encode menggunakan Base64 dan ditandatangani menggunakan algoritma kriptografi satu arah **HMAC SHA-256** menggunakan kunci gabungan: `Site Secret Key + System Secret Key`.
* Server target memanggil `POST /api/siteverify` untuk mengirimkan token tersebut. Server HumanCheck mendekode token dan memvalidasi keabsahan tanda tangan secara asimetris, menjamin tidak ada token yang dipalsukan.

### C. Proteksi Serangan Replay (Anti Replay Attack)
* **Token Expiration**: Token verifikasi hanya memiliki masa tenggang hidup selama **2 menit (120 detik)** sejak dikeluarkan. Pembatasan umur token mempersempit jendela eksploitasi serangan siber.
* **Nonce Cache Validation**: Setiap token berisikan sebuah kunci acak unik sekali-pakai (`nonce`). Ketika proses pemanggilan `/api/siteverify` dipicu, server akan menyimpan `nonce` tersebut ke dalam memori tertulis. Apabila ada pelaku siber melakukan pengiriman token yang sama berulang kali, server akan menolaknya dengan error `timeout-or-duplicate`.

### D. Keamanan Origin Domain (Anti Key Theft Tracker)
* Kunci publik (`SITE_KEY`) dapat dibaca secara bebas di halaman HTML klien. Guna mencegah pihak tak bertanggung jawab menyalin kunci tersebut dan memakainya di website mereka sendiri, HumanCheck menguji asal domain (`originHostname`).
* Server mencocokkan asal domain pengaju verifikasi dengan daftar domain sah yang ditentukan oleh developer di dashboard portal. Jika domain tidak terdaftar, token verifikasi dinyatakan tidak sah (`invalid-domain`).
