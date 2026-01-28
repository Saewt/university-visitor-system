# Üniversite Tanıtım Günü - Ziyaretçi Kayıt Sistemi

Üniversite tanıtım günlerinde kullanılacak, web tabanlı ziyaretçi kayıt ve yönetim sistemi. Rehber öğretmenler öğrenci bilgilerini girer, veriler ortak veritabanında toplanır, admin panelinde gerçek zamanlı görüntülenir ve Excel olarak dışa aktarılabilir.

## Özellikler

- **Öğrenci Kaydı**: Rehber öğretmenler için hızlı öğrenci kayıt formu
- **Admin Paneli**: Gerçek zamanlı istatistikler ve yönetim paneli
- **Canlı Güncellemeler**: SSE (Server-Sent Events) ile anlık veri güncellemeleri
- **Excel Dışa Aktarım**: Tarih aralığı ve bölüme göre filtreli Excel raporları
- **Telegram Bildirimleri**: Okul turu istekleri için otomatik Telegram bildirimleri
- **İstatistikler**: Bölüm dağılımı, YKS türü analizi, saatlik yoğunluk grafikleri
- **SQLite**: Dosya tabanlı veritabanı - kurulum gerektirmez

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + Vite |
| Backend | Python + FastAPI |
| Veritabanı | SQLite (kurulum gerektirmez) |
| Real-time | Server-Sent Events (SSE) |
| Mesajlaşma | Telegram Bot API |
| Excel | openpyxl |

## Proje Yapısı

```
managementadvertise/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # FastAPI uygulama
│   │   ├── database.py        # SQLite bağlantısı
│   │   ├── models.py          # SQLAlchemy modelleri
│   │   ├── schemas.py         # Pydantic şemaları
│   │   ├── config.py          # Konfigürasyon
│   │   ├── seeds.py           # Başlangıç verileri
│   │   ├── routers/           # API endpoint'leri
│   │   │   ├── auth.py        # Kimlik doğrulama
│   │   │   ├── students.py    # Öğrenci CRUD
│   │   │   ├── stats.py       # İstatistikler
│   │   │   └── export.py      # Excel dışa aktarma
│   │   └── services/
│   │       ├── telegram.py    # Telegram bot servisi
│   │       ├── mock_telegram.py # Mock telegram (test)
│   │       └── sse.py         # Server-Sent Events
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py                 # Geliştirme sunucusu
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/        # React bileşenleri
│   │   ├── pages/             # Sayfalar
│   │   ├── services/          # API servisleri
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── university_visitors.db     # SQLite veritabanı (otomatik oluşur)
```

## Kurulum

### 1. Backend Kurulumu

```bash
cd backend

# Sanal ortam oluştur
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# .env dosyasını oluştur (opsiyonel, varsayılan değerler çalışır)
cp .env.example .env
```

Backend'i başlatın:

```bash
# Yöntem 1: run.py ile
python run.py

# Yöntem 2: uvicorn ile
uvicorn app.main:app --reload --port 8000
```

İlk başlatmada veritabanı ve varsayılan admin kullanıcısı otomatik oluşturulur.

API dokümantasyonu: http://localhost:8000/docs

### 2. Frontend Kurulumu

```bash
cd frontend

# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

Uygulama: http://localhost:5173

## Kullanım

### Varsayılan Kullanıcı

```
Kullanıcı Adı: admin
Şifre: admin123
```

### Sayfalar

| Sayfa | URL | Açıklama |
|-------|-----|----------|
| Giriş | `/login` | Admin/öğretmen girişi |
| Kayıt | `/register` | Öğrenci kayıt formu |
| Admin | `/admin` | Dashboard ve istatistikler |

### Telegram Bot Entegrasyonu (Opsiyonel)

1. [@BotFather](https://t.me/BotFather) ile yeni bot oluşturun
2. Bot token'ı `.env` dosyasına ekleyin: `TELEGRAM_BOT_TOKEN=your_token`
3. Her bölüm için Telegram grubu oluşturun
4. Bot'u gruba ekleyin ve admin yapın
5. Grup chat ID'sini veritabanına ekleyin (DB browser ile):

```sql
UPDATE departments
SET telegram_chat_id = '-1001234567890'
WHERE name = 'Bilgisayar Mühendisliği';
```

## API Endpoint'leri

### Authentication
```
POST /api/auth/login          # Giriş
POST /api/auth/logout         # Çıkış
GET  /api/auth/me             # Mevcut kullanıcı
```

### Students
```
GET    /api/students          # Öğrenci listesi
GET    /api/students/{id}     # Tek öğrenci
POST   /api/students          # Yeni öğrenci
PUT    /api/students/{id}     # Öğrenci güncelle
DELETE /api/students/{id}     # Öğrenci sil
GET    /api/students/departments/list  # Bölüm listesi
```

### Statistics
```
GET /api/stats/summary        # Genel özet
GET /api/stats/by-department  # Bölüme göre dağılım
GET /api/stats/by-type        # YKS türüne göre dağılım
GET /api/stats/tour-requests  # Tur istekleri
GET /api/stats/hourly         # Saatlik yoğunluk
GET /api/stats                # Tüm istatistikler
```

### Export
```
GET /api/export/excel         # Excel dosyası indir
GET /api/export/daily/{date}  # Günlük rapor
```

## Deployment

### Backend (Heroku, Render, Railway vb.)

SQLite dosya tabanlı olduğu için platformlar arasında taşınabilir. Dosyanın kalıcı olması için `/tmp` dışında bir path kullanın:

```bash
# .env dosyasında
DATABASE_URL=sqlite:////app/data/university_visitors.db
```

### Frontend (Vercel, Netlify vb.)

```bash
cd frontend
npm run build
# Build çıktısını deployment platformuna yükleyin
```

## Veritabanı Yönetimi

Veritabanı dosyası: `university_visitors.db`

### İçeriği görüntüleme (SQLite Browser)
- [DB Browser for SQLite](https://sqlitebrowser.org/) indirin
- `university_visitors.db` dosyasını açın

### Komut satırından sorgu
```bash
sqlite3 university_visitors.db
SELECT * FROM users;
SELECT * FROM departments;
SELECT * FROM students;
```

### Veritabanını sıfırlama
```bash
rm university_visitors.db
# Sunucuyu yeniden başlatın, yeniden oluşacaktır
```

## Lisans

MIT

## Destek

Sorular için issue açabilirsiniz.
