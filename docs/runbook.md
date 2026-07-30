# Runbook — Sık Karşılaşılan Sorunlar

Cluster'da bir şeyler ters giderse önce bu listeye bak.

## 1. Pod `ImagePullBackOff` / `ErrImagePull`

**Belirti:**
```
backend-xxxxx   0/1   ImagePullBackOff   0   30s
```

**Sebep:** Kubernetes belirtilen tag'e sahip bir imaj bulamıyor. kind kullanırken en sık sebep, imajın `kind load docker-image` ile cluster'a yüklenmemiş olması — kind, host makinedeki Docker imajlarını otomatik görmez.

**Çözüm:**
```bash
docker images | grep todo-backend        # imaj gerçekten var mı, tag doğru mu
kind load docker-image todo-backend:v1 --name todo
kubectl rollout restart deployment/backend -n todo
```

Yanlış/var olmayan bir tag'e geçildiyse (`kubectl set image ... :yanlis-tag`), en hızlı çözüm rollback:
```bash
kubectl rollout undo deployment/backend -n todo
```
(Bu senaryoyu gerçekten test ettik, bkz. [`docs/demo.md`](./demo.md) — `maxUnavailable: 0` sayesinde eski pod'lar ayakta kalmaya devam etti, kullanıcı hiçbir kesinti yaşamadı.)

## 2. Pod `CrashLoopBackOff`

**Belirti:** Pod sürekli başlayıp çöküyor, `RESTARTS` sayısı artıyor.

**Teşhis:**
```bash
kubectl logs <pod-adı> -n todo
kubectl logs <pod-adı> -n todo --previous   # bir önceki (çökmüş) çalıştırmanın loglarını gösterir
kubectl describe pod <pod-adı> -n todo      # Events kısmına bak
```

**Yaygın sebepler bu projede:**
- Ortam değişkeni eksik/yanlış (ConfigMap/Secret referansı bozuk) → `kubectl describe pod` içinde `envFrom` hatası görünür
- Uygulama kodu hata fırlatıp çıkıyor → log'daki stack trace'e bak
- Liveness probe çok erken başlıyor (`initialDelaySeconds` yetersiz) → pod ayağa kalkmadan sağlık kontrolüne takılıp restart döngüsüne giriyor

## 3. Backend `/readyz` sürekli `503` dönüyor (Mongo'ya bağlanamıyor)

**Teşhis:**
```bash
kubectl get pods -n todo | grep mongodb
kubectl logs mongodb-0 -n todo
kubectl exec -it mongodb-0 -n todo -- mongosh -u todoadmin -p change-me-local-only --authenticationDatabase admin
```

**Yaygın sebepler:**
- `k8s/02-configmap.yaml` içindeki `MONGO_HOST` değeri gerçek Service/Pod adıyla uyuşmuyor (bu projede: `mongodb-0.mongodb.todo.svc.cluster.local`)
- `mongo-secret` içindeki kullanıcı adı/şifre backend'in beklediğiyle aynı değil
- `mongodb-0` pod'u henüz `Running` değil — backend ondan önce ayağa kalkmaya çalışıyor (kısa süreli, genelde kendi kendine düzelir)

## 4. Ingress üzerinden `todo.local` açılmıyor

**Teşhis:**
```bash
kubectl get ingress -n todo
kubectl describe ingress todo -n todo
kubectl get pods -n ingress-nginx
cat /etc/hosts | grep todo.local
```

**Yaygın sebepler:**
- `/etc/hosts`'a `127.0.0.1 todo.local` satırı eklenmemiş
- `ingress-nginx-controller` pod'u henüz hazır değil (`scripts/kind-up.sh` bunu bekliyor ama manuel kurulumda unutulabilir)
- Servis adları Ingress'teki referanslarla uyuşmuyor (`k8s/06-ingress.yaml` → `backend`/`frontend` Service adları)

## 5. Genel kural

Bir şey beklenmedik davranıyorsa sırayla:
```bash
kubectl get pods -n todo
kubectl describe pod <pod-adı> -n todo
kubectl logs <pod-adı> -n todo
```
Bu üçü, sorunların büyük kısmını 1 dakikada teşhis eder.
