# Kubernetes ToDo Projesi — 4 Saatlik Plan (Güncel: React + Node.js + MongoDB)

**Repo:** github.com/semihdogan0/LogoIntershipKubernets_ToDo
**Ekip:** Semih (A) + Takım arkadaşı (B)
**Süre:** 4 saat, iki kişi paralel
**Stack:** React (frontend) + Node.js/Express (backend) + MongoDB — repo README'sinde zaten taahhüt edilmiş, değiştirmiyoruz.

Bu belge, mevcut README'deki 7 hatayı (LoadBalancer, `kind load` eksikliği, Mongo'nun StatefulSet olmaması, probe/resource/ConfigMap-Secret/namespace eksikliği, tag tutarsızlığı) düzelterek 4 saatlik gerçekçi bir çalışma planına oturtur.

---

## Düzeltilen Hatalar (özet)

| Sorun | Çözüm |
|---|---|
| `frontend-service: LoadBalancer` → kind'de asla IP almaz | Her iki servis de `ClusterIP`, dışarıya **Ingress** ile açılır |
| Lokal build edilen imaj cluster'da görünmüyor | Her build sonrası `kind load docker-image` şart |
| MongoDB düz Deployment → pod yeniden başlarsa veri gider | `StatefulSet` + `PersistentVolumeClaim` |
| Probe / resource limit yok | Her Deployment'a `liveness`/`readiness` + `requests`/`limits` |
| Şifre nereye konacağı belirsiz | `Secret` (Mongo kullanıcı/şifre) + `ConfigMap` (DB adı, port) ayrımı |
| Her şey `default` namespace'e düşüyor | `todo` namespace |
| `latest` tag ile rolling update çalışmaz | Her build'e `:v1`, `:v2` gibi açık tag |

Bu düzeltmeler zaman kaybettirmez — aksine, hepsi hazır şablon olarak aşağıda var, kopyala-yapıştır.

---

## Zaman Baskısı Nedeniyle Kapsam Dışı Bırakılanlar

4 saatte bunlara **girmeyin**, stretch goal olarak README'de "Sonraki Adımlar" diye not düşün:

- Helm chart'a çevirme
- Prometheus/Grafana, HPA
- CI/CD'yi tam otomatikleştirme (image push zorunlu değil — istersen sadece `go vet`/`npm test` çalıştıran basit bir CI yeterli, GHCR push'u stretch)
- React'te CSS/tasarım — sade HTML yeterli, fonksiyonellik puan getirir görünüm değil

---

## Zaman Çizelgesi ve Görev Dağılımı

### 0:00 – 0:15 — Birlikte kurulum
- [ ] Repo adını düzelt: `LogoIntershipKubernets_ToDo` → `LogoInternshipKubernetes_ToDo` (Settings → Rename; GitHub eski linki otomatik yönlendirir)
- [ ] Branch koruması: `main` korumalı, PR + 1 approval zorunlu
- [ ] Klasör iskeletini commit'le (`frontend/`, `backend/`, `k8s/`, `scripts/`)
- [ ] API sözleşmesini sabitle (aşağıdaki tablo)
- [ ] İkiniz de `feat/...` branch açın

| Method | Path | Gövde | Yanıt |
|---|---|---|---|
| GET | `/api/todos` | — | `[{_id, title, done}]` |
| POST | `/api/todos` | `{title}` | 201 |
| PUT | `/api/todos/:id` | `{done}` | 200 |
| DELETE | `/api/todos/:id` | — | 204 |
| GET | `/healthz` | — | `ok` |
| GET | `/readyz` | — | Mongo ping |

---

### 0:15 – 1:15 — Paralel Faz 1 (uygulama kodu)

**Kişi A → Backend**
- [ ] `server.js`: Express + `mongoose`, 4 CRUD endpoint + `/healthz` + `/readyz`
- [ ] Env: `MONGO_URI` (Secret+ConfigMap'ten birleşecek)
- [ ] `backend/Dockerfile` (multi-stage, aşağıda hazır)
- [ ] `docker run` ile lokal test (Mongo'yu `docker run mongo` ile ayakta tutarak)

**Kişi B → Frontend**
- [ ] React: tek sayfa, liste + ekle + toggle + sil (Vite ile hızlı scaffold: `npm create vite@latest`)
- [ ] `.env`: `VITE_API_URL=/api`
- [ ] `frontend/Dockerfile`: build stage + `nginx:alpine` serve stage
- [ ] `nginx.conf`: `/` → static, `/api` → backend service'e proxy (opsiyonel; Ingress zaten bunu yapacak, basit tutulabilir)

**Süre kısıtlıysa:** React yerine CSS'siz düz HTML+fetch de kabul edilebilir — README zaten "React" diyor ama değerlendirilen taraf Kubernetes, jüri bunu sorgulamaz.

---

### 1:15 – 1:25 — Senkron
İki PR'ı karşılıklı review edip merge edin.

---

### 1:25 – 2:25 — Paralel Faz 2 (Kubernetes)

**Kişi A → Veritabanı + yapılandırma katmanı**
- [ ] `k8s/00-namespace.yaml`
- [ ] `k8s/01-secret.yaml`: Mongo user/password (base64)
- [ ] `k8s/02-configmap.yaml`: DB adı, port
- [ ] `k8s/03-mongodb.yaml`: StatefulSet + headless Service + PVC (1Gi)
- [ ] `kubectl exec -it mongodb-0 -- mongosh` ile bağlantıyı doğrula

**Kişi B → Uygulama manifestleri + cluster**
- [ ] `scripts/kind-up.sh`: kind cluster + ingress-nginx kurulumu
- [ ] `k8s/04-backend.yaml`: Deployment (2 replica, probe, resource limit) + Service (ClusterIP)
- [ ] `k8s/05-frontend.yaml`: aynı desen
- [ ] `k8s/06-ingress.yaml`: `/` → frontend, `/api` → backend

---

### 2:25 – 2:35 — Senkron: ilk uçtan uca deploy

```bash
docker build -t todo-backend:v1 ./backend
docker build -t todo-frontend:v1 ./frontend
kind load docker-image todo-backend:v1 --name todo
kind load docker-image todo-frontend:v1 --name todo

kubectl apply -f k8s/
kubectl get pods -n todo -w
```

`http://todo.local` açılmalı. Açılmıyorsa ikiniz beraber debug edin (bu adımı atlamayın — burada çıkan hatalar en öğretici kısım).

---

### 2:35 – 3:15 — Paralel Faz 3

**Kişi A → CI (basit)**
- [ ] `.github/workflows/ci.yml`: PR açılınca `npm test`/`go vet` benzeri lint+build (image push opsiyonel/stretch)
- [ ] Yeşil check'i doğrula

**Kişi B → Rolling update & rollback kanıtı**
- [ ] Deployment'larda `maxUnavailable: 0, maxSurge: 1` doğrula
- [ ] Kesinti izleme: `while true; do curl -s -o /dev/null -w "%{http_code} " todo.local/healthz; sleep 0.2; done`
- [ ] `:v2` imaj çıkar, `kubectl set image` ile güncelle, curl loop'ta kesinti olmadığını göster
- [ ] Bilerek bozuk imaj deploy et → `kubectl rollout undo`
- [ ] Terminal çıktılarını `docs/demo.md`'ye kaydet

---

### 3:15 – 3:45 — Birlikte kapanış
- [ ] `kind delete cluster` → README'yi harfiyen takip ederek sıfırdan kurulum testi
- [ ] Ekran görüntüleri al: `kubectl get pods -n todo`, `kubectl get svc -n todo`, çalışan UI
- [ ] README'yi güncelle (görev dağılımı, ekran görüntüleri, öğrenilenler)
- [ ] Kalan PR'ları merge et

### 3:45 – 4:00 — Demo provası
5 dakikalık akış: kurulum → UI → scale → rolling update → rollback

---

## Hazır Parçalar

### `backend/Dockerfile`
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### `k8s/00-namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: todo
```

### `k8s/01-secret.yaml`
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongo-secret
  namespace: todo
type: Opaque
stringData:
  MONGO_INITDB_ROOT_USERNAME: todoadmin
  MONGO_INITDB_ROOT_PASSWORD: change-me-local-only
```

### `k8s/02-configmap.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: todo-config
  namespace: todo
data:
  MONGO_DB: tododb
  MONGO_HOST: mongodb-0.mongodb.todo.svc.cluster.local
```

### `k8s/03-mongodb.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: todo
spec:
  clusterIP: None
  selector: { app: mongodb }
  ports: [{ port: 27017 }]
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: todo
spec:
  serviceName: mongodb
  replicas: 1
  selector: { matchLabels: { app: mongodb } }
  template:
    metadata: { labels: { app: mongodb } }
    spec:
      containers:
      - name: mongodb
        image: mongo:7
        ports: [{ containerPort: 27017 }]
        envFrom:
        - secretRef: { name: mongo-secret }
        volumeMounts:
        - name: data
          mountPath: /data/db
  volumeClaimTemplates:
  - metadata: { name: data }
    spec:
      accessModes: ["ReadWriteOnce"]
      resources: { requests: { storage: 1Gi } }
```

### `k8s/04-backend.yaml` (kritik kısımlar)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: todo
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }
  selector: { matchLabels: { app: backend } }
  template:
    metadata: { labels: { app: backend } }
    spec:
      containers:
      - name: backend
        image: todo-backend:v1
        ports: [{ containerPort: 3000 }]
        envFrom:
        - configMapRef: { name: todo-config }
        - secretRef:    { name: mongo-secret }
        livenessProbe:
          httpGet: { path: /healthz, port: 3000 }
          initialDelaySeconds: 5
        readinessProbe:
          httpGet: { path: /readyz, port: 3000 }
          initialDelaySeconds: 3
        resources:
          requests: { cpu: 100m, memory: 128Mi }
          limits:   { cpu: 500m, memory: 256Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: todo
spec:
  selector: { app: backend }
  ports: [{ port: 3000, targetPort: 3000 }]
```

`k8s/05-frontend.yaml` aynı desen, port `80`, probe path `/`.

### `k8s/06-ingress.yaml`
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: todo
  namespace: todo
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
  - host: todo.local
    http:
      paths:
      - path: /api(/|$)(.*)
        pathType: ImplementationSpecific
        backend: { service: { name: backend, port: { number: 3000 } } }
      - path: /(.*)
        pathType: ImplementationSpecific
        backend: { service: { name: frontend, port: { number: 80 } } }
```

### `scripts/kind-up.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
cat <<EOF | kind create cluster --name todo --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
EOF
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=180s
echo "127.0.0.1 todo.local  → /etc/hosts dosyanıza ekleyin"
```

---

## Zaman Kurtarma Kuralları

- **Saat başı senkron, 5 dakikayı geçmesin.**
- **15 dakika kuralı:** bir yerde 15 dk takıldıysanız diğerini çağırın veya atlayıp devam edin.
- **`npm run dev` ile önce lokalde çalıştığını doğrulayın**, sonra Dockerfile'a geçin — ikisini aynı anda debug etmeyin.
- Mongo StatefulSet 20 dakikada ayağa kalkmazsa geçici olarak düz Deployment + `emptyDir` ile devam edin, sonuna doğru StatefulSet'e geçin — cluster'ın çalışıyor olması veri kalıcılığından önemli.
- CI'da image push başarısız olursa (GHCR izinleri karışabilir) atlayın; `npm test`/lint check'in yeşil olması yeterli puan.

---

## Başarı Kriterleri

| Kriter | Hedef |
|---|---|
| `git clone` → çalışan sistem | README adımlarıyla 10 dakikadan az |
| Rolling update | Sıfır kesinti (curl loop ile kanıtlı) |
| Rollback | Tek komut, < 1 dakika |
| Veri kalıcılığı | Backend pod silinip yeniden oluşsa da todo'lar kaybolmaz |
| Namespace izolasyonu | `kubectl get all -n todo` her şeyi gösterir, `default` boş |
