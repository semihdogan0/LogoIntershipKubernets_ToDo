# Öğrenme Rehberi — Bu Projede Kullanılan Teknolojiler

Bu belge, projede kullandığımız her teknolojiyi ve yazdığımız kodun neden bu şekilde çalıştığını açıklamak için hazırlandı. Amaç, sadece "çalışıyor" demek değil, her satırın ne işe yaradığını anlamak.

## Genel Resim

Uygulama üç parçadan oluşuyor: bir React arayüzü, bir Node.js/Express API'si ve bir MongoDB veritabanı. Bu üç parça birbirinden bağımsız birer container olarak paketlendi ve Kubernetes üzerinde ayrı ayrı çalışan pod'lar halinde dağıtıldı. Kullanıcı tarayıcıdan `todo.local` adresine gittiğinde istek önce Ingress'e düşüyor, Ingress isteğin yoluna (`/` mi `/api` mi) bakarak onu frontend'e ya da backend'e yönlendiriyor, backend de ihtiyaç duyduğunda MongoDB'ye bağlanıyor. Bu ayrım önemli çünkü her katman bağımsız olarak ölçeklenebiliyor, güncellenebiliyor ve yeniden başlatılabiliyor — biri çökse diğerleri etkilenmiyor.

## Docker ve Multi-Stage Build

Her iki servis de (backend ve frontend) container'landı, ama ikisinin Dockerfile'ı farklı bir problemi çözüyor.

Backend'in Dockerfile'ı iki aşamalı (multi-stage):

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

İlk aşama (`deps`) sadece bağımlılıkları kurmak için var. İkinci aşama, ilk aşamadan yalnızca `node_modules` klasörünü kopyalıyor ve geri kalan kodu ekliyor. Bunun tek aşamalı bir Dockerfile'a göre avantajı, npm'in build sırasında oluşturduğu geçici dosyaların ve cache'in final image'a hiç girmemesi — image daha küçük ve daha güvenli oluyor. `USER node` satırı da container'ın root yerine yetkisiz bir kullanıcıyla çalışmasını sağlıyor, bu bir güvenlik pratiği.

Frontend'in Dockerfile'ı farklı bir amaç için iki aşamalı: React kodu tarayıcıda çalışan statik dosyalara (`HTML`/`JS`/`CSS`) derlenmesi gerekiyor, ama bu derleme işlemi için Node.js gerekiyor, çalışma zamanında ise sadece bir web sunucusu yeterli:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

İlk aşama Vite ile `npm run build` çalıştırıp `dist/` klasörünü üretiyor. İkinci aşama bambaşka bir image (`nginx:alpine`) kullanıyor ve sadece o `dist/` klasörünü nginx'in servis ettiği yere kopyalıyor. Sonuç: final image'da Node.js hiç yok, sadece nginx ve birkaç statik dosya var — çok daha küçük ve production için uygun.

## Backend: Node.js, Express, Mongoose

`backend/server.js` dört CRUD endpoint'i ve iki sağlık kontrolü endpoint'i tanımlıyor. Mongoose kısmı şöyle başlıyor:

```js
const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Todo = mongoose.model('Todo', todoSchema);
```

Mongoose, MongoDB'nin şemasız (schemaless) doğasının üzerine bir şema katmanı koyuyor: `title` alanının zorunlu ve string olduğunu, `done`'ın varsayılan olarak `false` geldiğini burada tanımlıyoruz. `timestamps: true` ise Mongoose'a her kayda otomatik `createdAt`/`updatedAt` alanları eklemesini söylüyor — API yanıtlarında gördüğümüz o ekstra alanlar buradan geliyor.

En kritik kısım, `healthz` ve `readyz` ayrımı:

```js
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.get('/readyz', (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'not ready', db: 'disconnected' });
  }
  res.status(200).json({ status: 'ready' });
});
```

Bu ikisi birbirine benziyor ama farklı sorulara cevap veriyor. `healthz` sadece "Node.js süreci ayakta mı, event loop takılı mı" sorusuna cevap veriyor — Mongo'ya hiç bakmıyor. `readyz` ise "bu pod şu an gerçek trafiği karşılayabilir mi" sorusuna cevap veriyor, bunun için Mongo bağlantısının durumuna (`readyState`) bakıyor. Kubernetes bu ikisini farklı amaçlarla kullanıyor: `livenessProbe` başarısız olursa pod'u yeniden başlatır, `readinessProbe` başarısız olursa pod'u öldürmez ama ona trafik göndermeyi durdurur. Eğer ikisini aynı kontrole bağlasaydık, Mongo kısa süreliğine erişilemez olduğunda Kubernetes backend pod'unu gereksiz yere restart ederdi — oysa asıl istediğimiz, Mongo düzelene kadar sadece trafiği o pod'a göndermemek.

## Frontend: React ve Vite

`frontend/index.html`, `frontend/src/main.jsx` ve `frontend/src/App.jsx` üçlüsü, bir Vite/React projesinin standart iskeletini oluşturuyor. `index.html` içinde tek bir `<div id="root">` var, başka hiçbir şey yok — bütün arayüz JavaScript tarafından bu div'in içine yazılıyor. `main.jsx` bu bağlantıyı kuruyor:

```jsx
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`App.jsx` ise gerçek mantığı içeriyor. `useState` ile todo listesini ve input'taki metni tutuyor, `useEffect` ile bileşen ilk yüklendiğinde backend'den listeyi çekiyor:

```jsx
useEffect(() => {
  loadTodos();
}, []);
```

Boş bağımlılık dizisi (`[]`), bu efektin sadece bileşen ilk render olduğunda bir kere çalışacağını söylüyor — her state değişiminde tekrar çalışmıyor. Ekleme/silme/tamamlama işlemlerinin her biri backend'e bir `fetch` isteği atıp ardından `loadTodos()`'u tekrar çağırarak listeyi tazeliyor; yani state'i optimistik güncellemek yerine her işlemden sonra sunucudaki gerçek veriyi tekrar çekiyoruz — küçük bir proje için basit ve hataya kapalı bir yaklaşım.

`VITE_API_URL=/api` ortam değişkeni önemli: kod `${API}/todos` gibi göreli bir yol kullanıyor, backend'in tam adresini (IP, port) hiç bilmiyor. Bunun çalışabilmesinin sebebi, Ingress'in `/api` ile başlayan her isteği otomatik olarak backend Service'ine yönlendirmesi — frontend'in bunu bilmesine gerek yok, sadece kendi sunulduğu adresle aynı host'a `/api/...` isteği atıyor.

## Kubernetes'in Temel Yapı Taşları

**Pod, ReplicaSet, Deployment.** Pod, Kubernetes'in en küçük çalıştırılabilir birimi — içinde bir ya da daha fazla container barındırır. Biz Deployment yazdık ama Pod'u doğrudan yönetmiyoruz; Deployment aslında bir ReplicaSet oluşturuyor, ReplicaSet de "her zaman N tane pod ayakta olsun" kuralını uyguluyor. Deployment'ın kattığı ek özellik, sürüm geçişlerini (rolling update) yönetebilmesi — ReplicaSet tek başına sadece sayıyı korur, güncelleme stratejisi bilmez.

**Namespace.** `k8s/00-namespace.yaml` ile oluşturduğumuz `todo` namespace'i, bütün kaynaklarımızı mantıksal bir kutuya koyuyor. Bunun pratik faydası, `kubectl get pods` yazdığında cluster'daki her şeyi değil sadece bizim projemizi görmek, ve isim çakışması riskini ortadan kaldırmak (başka bir proje de `backend` adında bir Deployment açabilir, farklı namespace'te olduğu için çakışmaz).

**ConfigMap ve Secret.** İkisi de anahtar-değer çiftleri tutuyor ve pod'lara ortam değişkeni olarak enjekte ediliyor, ama amaçları farklı. ConfigMap (`02-configmap.yaml`) hassas olmayan ayarları (veritabanı adı, host adresi) tutuyor. Secret (`01-secret.yaml`) ise Mongo kullanıcı adı/şifresi gibi hassas bilgiyi tutuyor — base64 ile kodlanmış olarak saklanıyor (şifreleme değil, sadece encoding; gerçek bir üretim ortamında bunun yerine Sealed Secrets veya bir secret manager kullanılır, biz demo kapsamında düz Secret kullandık).

**StatefulSet ve Headless Service.** MongoDB için neden Deployment değil de StatefulSet kullandık? Deployment'taki pod'lar birbirinin aynısıdır ve rastgele isimler alır (`backend-869c6fb9c8-s7b6g` gibi) — hangi pod'un hangi disk üzerinde çalıştığı önemli değildir. Ama bir veritabanı için bu kabul edilemez: pod yeniden oluşturulduğunda aynı diske (aynı veriye) tekrar bağlanması gerekir. StatefulSet bunu sağlıyor: pod'lara sabit, öngörülebilir isimler veriyor (`mongodb-0`) ve her biri kendi `PersistentVolumeClaim`'ine bağlanıyor. `03-mongodb.yaml`'daki `clusterIP: None` ayarlı Service ise "headless Service" olarak adlandırılıyor — normal bir Service'in aksine tek bir sanal IP vermiyor, bunun yerine her pod'a kendi DNS adını veriyor: `mongodb-0.mongodb.todo.svc.cluster.local`. Backend işte bu adrese bağlanıyor; bu adres normal bir Service'in "hangi pod'a gittiği önemli değil, birine ulaş" mantığından farklı olarak "tam olarak şu pod'a ulaş" diyor.

Tam da bu DNS mekanizması yüzünden gerçek bir sorunla karşılaştık: backend, Mongo pod'u henüz `Ready` olmadan (dolayısıyla DNS kaydı oluşmadan) bağlanmaya çalışınca `ENOTFOUND` hatası aldı ve bir daha kendiliğinden tekrar denemedi. Bunu `docs/runbook.md`'ye detaylıca yazdık — gerçek bir başlangıç sıralaması (race condition) örneği.

**Service (ClusterIP) ve Ingress.** Backend ve frontend için yazdığımız Service'ler normal `ClusterIP` tipinde — cluster içinde sabit bir adres sağlıyorlar ama dışarıdan erişilemezler. Dışarıya açılan tek kapı Ingress: `06-ingress.yaml`, `todo.local` adresine gelen isteklerin yolunu inceleyip `/api` ile başlıyorsa backend Service'ine, değilse frontend Service'ine yönlendiriyor. Burada rewrite (path yeniden yazma) kullanmadık, çünkü backend zaten kendi route'larını `/api/todos` olarak tanımlıyor — Ingress path'i olduğu gibi ilettiği için ekstra bir dönüşüme gerek kalmadı.

**Probe'lar ve Resource Limits.** Her Deployment'ta `livenessProbe`, `readinessProbe`, `resources.requests` ve `resources.limits` tanımladık. `requests`, Kubernetes'e "bu container'ı çalıştırmak için en az bu kadar CPU/RAM ayır" diyor — scheduler pod'u hangi node'a yerleştireceğine bunu baz alarak karar veriyor. `limits` ise "bu container asla bunun üzerine çıkamaz" sınırı — bir pod'un hatalı kod yüzünden tüm node'un kaynağını tüketmesini engelliyor.

**Rolling Update ve Rollback.** `strategy.rollingUpdate.maxUnavailable: 0` ayarı, güncelleme sırasında hiçbir zaman eski pod sayısının hazır pod sayısının altına düşmemesini garanti ediyor — yani yeni pod tamamen hazır olmadan hiçbir eski pod kapatılmıyor. Bunu gerçekten test ettik: v2'ye geçişte ve hatta bilerek bozuk bir imaj verdiğimizde bile kullanıcı tarafında sıfır kesinti oldu (bkz. `docs/demo.md`). `kubectl rollout undo` komutu ise Deployment'ın önceki `ReplicaSet`'ini tekrar aktif hale getirerek geri dönüşü sağlıyor — Kubernetes her Deployment değişikliğini bir revizyon olarak sakladığı için bu mümkün.

## GitHub Actions (CI)

`.github/workflows/ci.yml`, her `push`/`pull_request` olayında iki ayrı iş (job) çalıştırıyor: biri backend için, biri frontend için. Her ikisi de önce bağımlılıkları kuruyor, sonra backend için basit bir sözdizimi kontrolü (`node --check`), frontend için ise gerçek bir production build (`npm run build`) yapıyor. Son adım olarak ikisi de kendi Dockerfile'larını build ediyor — bu, "kod çalışıyor" ile "bu kod gerçekten container'lanabiliyor" arasındaki farkı da yakalıyor. Registry'ye (GHCR) push etmedik çünkü bu, ekstra kimlik doğrulama/izin karmaşası gerektiriyordu ve zaman kısıtımız vardı; CI'ın asıl değeri zaten her PR'da otomatik doğrulama yapması, image dağıtımı ayrı bir konu.

## Git/GitHub İş Akışı

Projede SSH anahtarı ile kimlik doğrulama kurduk (her push'ta şifre/token sormaması için), `main` branch'i koruma altına aldık (doğrudan push yerine PR + review), ve `scripts/save.sh` ile `add + commit + push` işlemini tek komuta indirdik. Bu üçü birlikte, iki kişinin aynı repo üzerinde çakışmadan ve hızlı çalışabilmesini sağladı.

## Daha Fazla Okuma

Kubernetes'in resmi dokümantasyonu (özellikle "Concepts" bölümü) burada anlattığımız her kavramı çok daha ayrıntılı işliyor: kubernetes.io/docs/concepts. Docker'ın multi-stage build sayfası (docs.docker.com/build/building/multi-stage-builds) ve Mongoose'un resmi dokümantasyonu (mongoosejs.com/docs) da bu projede kullandığımız pratiklerin kaynağı.
