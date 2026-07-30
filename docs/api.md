# API Sözleşmesi

Backend (Express) ile frontend (React) arasındaki sabit sözleşme. Değiştirmeden önce iki taraf da haberdar olmalı.

| Method | Path | Gövde | Yanıt |
|---|---|---|---|
| GET | `/api/todos` | — | `200` — `[{_id, title, done, createdAt}]` |
| POST | `/api/todos` | `{title}` | `201` — oluşturulan kayıt, `400` title boşsa |
| PUT | `/api/todos/:id` | `{done?, title?}` | `200` — güncellenen kayıt, `404` yoksa |
| DELETE | `/api/todos/:id` | — | `204`, `404` yoksa |
| GET | `/healthz` | — | `200 ok` (liveness — süreç ayakta mı) |
| GET | `/readyz` | — | `200 {status: ready}` / `503` (readiness — Mongo bağlantısı var mı) |

## Ortam Değişkenleri (backend)

| Değişken | Açıklama | Yerel varsayılan |
|---|---|---|
| `PORT` | Backend'in dinlediği port | `3000` |
| `MONGO_HOST` | Mongo servis adresi | `localhost` |
| `MONGO_DB` | Veritabanı adı | `tododb` |
| `MONGO_INITDB_ROOT_USERNAME` | Mongo kullanıcı adı | — |
| `MONGO_INITDB_ROOT_PASSWORD` | Mongo şifre | — |

Kubernetes'te `MONGO_HOST/DB` → ConfigMap, `MONGO_INITDB_ROOT_*` → Secret'tan gelecek.
