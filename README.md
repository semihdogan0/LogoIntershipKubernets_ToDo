# Kubernetes ToDo App

[![CI](https://github.com/semihdogan0/LogoIntershipKubernets_ToDo/actions/workflows/ci.yml/badge.svg)](https://github.com/semihdogan0/LogoIntershipKubernets_ToDo/actions)

React + Node.js + MongoDB tabanlı ToDo uygulamasının Docker ile container'lanıp Kubernetes üzerinde dağıtılması.
**Logo Yazılım DevOps Stajı — 2 kişilik ekip projesi**

---

## Proje Amacı

Kubernetes'in temel bileşenlerini uçtan uca bir uygulama üzerinde öğrenmek ve uygulamak.

**Kapsanan konular:** Pod · ReplicaSet · Deployment · Service · Ingress · ConfigMap · Secret · PersistentVolumeClaim · Probe'lar · Resource limits · Rolling Update · Rollback · Scaling

---

## Mimari

```
                    ┌──────────────────────┐
   Browser ────────▶│  Ingress (nginx)     │
                    │  todo.local          │
                    └──────┬───────────┬───┘
                       /   │           │  /api
                  ┌────────▼───┐  ┌────▼────────┐
                  │  frontend  │  │  backend    │
                  │  React     │  │  Node.js    │
                  │  Deploy ×2 │  │  Deploy ×2  │
                  └────────────┘  └──────┬──────┘
                                         │
                                  ┌──────▼──────┐
                                  │  MongoDB    │
                                  │ StatefulSet │
                                  │  + PVC 1Gi  │
                                  └─────────────┘

Namespace: todo
```

---

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Frontend | React (Vite), nginx ile servis |
| Backend | Node.js + Express |
| Veritabanı | MongoDB 7 |
| Container | Docker (multi-stage build) |
| Orkestrasyon | Kubernetes (kind) |
| CI/CD | GitHub Actions (bağımlılık kurulumu, build ve Docker image doğrulaması — registry push yok) |

---

## API Sözleşmesi

Ayrıntılı sürüm ve ortam değişkenleri için bkz. [`docs/api.md`](./docs/api.md).

| Method | Path | Gövde | Yanıt |
|---|---|---|---|
| GET | `/api/todos` | — | `[{_id, title, done}]` |
| POST | `/api/todos` | `{title}` | 201 + kayıt |
| PUT | `/api/todos/:id` | `{done}` | 200 + kayıt |
| DELETE | `/api/todos/:id` | — | 204 |
| GET | `/healthz` | — | `ok` (liveness) |
| GET | `/readyz` | — | Mongo ping (readiness) |

---

## Proje Yapısı

```
.
├── .github/workflows/ci.yml
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       └── App.jsx
├── backend/
│   ├── Dockerfile
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-secret.yaml
│   ├── 02-configmap.yaml
│   ├── 03-mongodb.yaml      # StatefulSet + headless Service + PVC
│   ├── 04-backend.yaml      # Deployment + Service
│   ├── 05-frontend.yaml     # Deployment + Service
│   └── 06-ingress.yaml
├── scripts/
│   ├── kind-up.sh
│   └── save.sh              # tek komutla add+commit+push
├── docs/
│   ├── api.md               # backend/frontend API sözleşmesi
│   ├── demo.md               # rolling update & rollback testi, gerçek çıktılarla
│   └── runbook.md            # sık karşılaşılan sorunlar ve çözümleri
└── images/
```

---

## Kurulum

### Ön Koşullar

`docker` · `kubectl` · `kind`

### 1. Cluster'ı ayağa kaldır

```bash
./scripts/kind-up.sh
echo "127.0.0.1 todo.local" | sudo tee -a /etc/hosts
```

### 2. Image'ları build et ve cluster'a yükle

```bash
docker build -t todo-backend:v1 ./backend
docker build -t todo-frontend:v1 ./frontend

kind load docker-image todo-backend:v1 --name todo
kind load docker-image todo-frontend:v1 --name todo
```

> `kind load` adımı zorunlu. Aksi halde kind kendi container registry'sinde image'ı bulamaz ve pod `ErrImagePull` verir.

### 3. Deploy et

```bash
kubectl apply -f k8s/
kubectl wait --for=condition=ready pod --all -n todo --timeout=180s
```

### 4. Aç

http://todo.local

---

## Doğrulama

```bash
kubectl get all -n todo
kubectl get pvc -n todo
kubectl describe ingress todo -n todo
```

---

## Ölçekleme (Scaling)

```bash
kubectl scale deployment backend --replicas=5 -n todo
kubectl get pods -n todo -w
```

---

## Rolling Update & Rollback — Test Edildi ✓

Deployment `maxUnavailable: 0` ile yapılandırıldığı için güncelleme sırasında kesinti olmaz. Bu, gerçek bir senaryoyla doğrulandı: kesinti izleyici (`curl` loop) çalışırken v1 → v2 güncellemesi yapıldı, ardından kasıtlı olarak var olmayan bir imaj tag'ine geçilip Kubernetes'in bunu nasıl karşıladığı gözlemlendi, sonrasında rollback ile geri dönüldü.

**Özet sonuç:** Test boyunca tek bir istek bile başarısız olmadı — bozuk imaj deploy edildiğinde bile eski pod'lar `maxUnavailable: 0` sayesinde ayakta kaldı, yeni pod `ImagePullBackOff`'a düşse dahi kullanıcı hiçbir kesinti yaşamadı. Rollback ~1 dakikada tamamlandı.

Tüm komutlar, gerçek terminal çıktıları ve öğrenilen dersler için bkz. **[`docs/demo.md`](./docs/demo.md)**.

```bash
# Kısaca akış:
docker build -t todo-backend:v2 ./backend
kind load docker-image todo-backend:v2 --name todo
kubectl set image deployment/backend backend=todo-backend:v2 -n todo
kubectl rollout status deployment/backend -n todo

# Geri dönüş gerekirse:
kubectl rollout history deployment/backend -n todo
kubectl rollout undo deployment/backend -n todo
```

Sorun giderme için bkz. **[`docs/runbook.md`](./docs/runbook.md)**.

---

## Kullanılan Kubernetes Kaynakları

| Kaynak | Bu projedeki rolü |
|---|---|
| **Namespace** | Tüm kaynaklar `todo` altında izole |
| **Deployment** | frontend ve backend pod'larının sürüm yönetimi |
| **ReplicaSet** | Deployment tarafından yönetilen, istenen replica sayısını koruyan katman |
| **StatefulSet** | MongoDB için sabit kimlik ve kalıcı disk |
| **PersistentVolumeClaim** | Pod silinse de veritabanı verisinin kaybolmaması |
| **Service** | ClusterIP ile pod'lar arası servis keşfi |
| **Ingress** | Tek giriş noktası, path bazlı yönlendirme (`/` → frontend, `/api` → backend) |
| **ConfigMap** | Hassas olmayan yapılandırma (DB adı, port) |
| **Secret** | MongoDB kullanıcı adı/şifresi |
| **Liveness / Readiness Probe** | Ölü pod'un yeniden başlatılması, hazır olmayan pod'a trafik gitmemesi |
| **Resource requests/limits** | Bir pod'un node'u tüketmesini engelleme |
| **Rolling Update** | Sıfır kesintili sürüm geçişi |

---

## Görev Dağılımı

| Alan | Sorumlu |
|---|---|
| Backend API + Dockerfile | Kişi A |
| Frontend (React + Vite) + Dockerfile | Kişi B |
| MongoDB StatefulSet, Secret, ConfigMap | Kişi A |
| Deployment / Service / Ingress | Kişi A |
| GitHub Actions CI | Kişi A |
| Rolling update & rollback testi (`docs/demo.md`) | Kişi A |
| Runbook, README | Ortak |

> Not: Kişi B'nin şirket bilgisayarında Docker/Kubernetes kurulum yetkisi olmadığı için cluster'a dokunan tüm işler (manifestler, deploy, rolling update/rollback testi) Kişi A'nın makinesinde yapıldı. Kişi B uygulama kodu ve dokümantasyon tarafına odaklandı.

Her PR karşı taraf tarafından review edilir; `main`'e doğrudan push kapalıdır.

---

## Ekran Görüntüleri

> TODO: Aşağıdaki görseller yer tutucudur — `images/` klasörüne gerçek ekran görüntülerini ekleyip bu bölümü güncelleyin (pod listesi, service listesi, çalışan uygulama, rolling update terminal çıktısı).

### Pod Listesi
![Pod Listesi](images/pods.png)

### Service Listesi
![Service Listesi](images/services.png)

### Uygulama
![Uygulama](images/app.png)

### Rolling Update
![Rolling Update](images/rolling-update.png)

---

## Öğrenilen Konular

- Multi-stage Docker build ile küçük ve güvenli image üretimi
- Kubernetes kaynak modeli: Pod → ReplicaSet → Deployment ilişkisi
- Stateless (Deployment) ve stateful (StatefulSet + PVC) iş yükleri arasındaki fark
- Servis keşfi ve Ingress ile dış dünyaya açılma
- Yapılandırma yönetimi: ConfigMap ve Secret ayrımı
- Probe'lar ile sağlık kontrolü ve sıfır kesintili dağıtım
- Rolling update ve rollback stratejileri
- Yatay ölçekleme
- GitHub Actions ile image build ve registry'ye push

---

## CV Açıklaması

> React, Node.js ve MongoDB tabanlı bir ToDo uygulamasını multi-stage Docker build ile container'layıp Kubernetes (kind) üzerinde dağıttım. Deployment, StatefulSet, Service, Ingress, ConfigMap ve Secret kaynaklarını yapılandırdım; liveness/readiness probe'ları ve resource limitleri tanımlayarak `maxUnavailable: 0` ile sıfır kesintili rolling update ve rollback senaryolarını gerçek testlerle doğruladım (bkz. docs/demo.md). GitHub Actions ile build ve Docker image doğrulaması yapan bir CI hattı kurdum.

---

## Ekip

- [Semih Doğan](https://github.com/semihdogan0)
- [Takım arkadaşı]
