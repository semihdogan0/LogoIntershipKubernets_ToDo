# Rolling Update & Rollback Demo

Bu test, `backend` Deployment'ının `maxUnavailable: 0` stratejisiyle sıfır kesintili güncelleme ve geri dönüş (rollback) yapabildiğini kanıtlar. Kind cluster üzerinde, `todo` namespace'inde çalıştırıldı.

## Ortam

- Cluster: kind (`todo`)
- Namespace: `todo`
- Deployment: `backend` (2 replica, `RollingUpdate` / `maxUnavailable: 0`, `maxSurge: 1`)
- İzleme: `http://todo.local/api/todos` adresine 0.3 saniyede bir `curl` isteği

## 1. Kesinti İzleyicisi

```bash
while true; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://todo.local/api/todos)
  echo "$(date +%T) -> $code"
  sleep 0.3
done
```

**Sonuç:** Test boyunca (rolling update + bozuk deploy + rollback) kesintisiz `200` kodu alındı. Hiçbir istek düşmedi.

## 2. Rolling Update (v1 → v2)

`backend/server.js` içinde küçük bir değişiklik yapılıp yeni imaj build edildi:

```bash
docker build -t todo-backend:v2 ./backend
kind load docker-image todo-backend:v2 --name todo
kubectl set image deployment/backend backend=todo-backend:v2 -n todo
kubectl rollout status deployment/backend -n todo
```

`maxUnavailable: 0` sayesinde yeni pod hazır olmadan eski pod'lar öldürülmedi — kesinti izleyicide kesinti gözlenmedi.

## 3. Kasıtlı Bozuk Deploy

Var olmayan bir imaj tag'ine geçilerek Kubernetes'in hatalı bir sürümü nasıl karşıladığı test edildi:

```bash
kubectl set image deployment/backend backend=todo-backend:v3-bozuk -n todo
kubectl get pods -n todo -w
```

**Gözlemlenen çıktı:**
```
backend-66db8c4d9d-s4rjc    0/1     ContainerCreating   0          0s
backend-7d8bdf547-972qs     1/1     Running             0          2m3s
backend-7d8bdf547-n75jn     1/1     Running             0          117s
...
backend-66db8c4d9d-s4rjc    0/1     ErrImagePull         0          2s
backend-66db8c4d9d-s4rjc    0/1     ImagePullBackOff     0          13s
```

**Önemli gözlem:** Yeni pod `ImagePullBackOff`'a düştü ama eski iki pod (`backend-7d8bdf547-*`) `1/1 Running` kalmaya devam etti. Kubernetes, yeni pod sağlıklı hale gelmeden eskilerini kapatmadı — bu yüzden kullanıcı tarafında hiçbir kesinti yaşanmadı, sadece deployment "askıda" kaldı.

## 4. Rollback

```bash
kubectl rollout history deployment/backend -n todo
kubectl rollout undo deployment/backend -n todo
kubectl rollout status deployment/backend -n todo
kubectl get pods -n todo
```

**Çıktı:**
```
deployment.apps/backend
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
3         <none>

deployment.apps/backend rolled back
deployment "backend" successfully rolled out

NAME                        READY   STATUS        RESTARTS   AGE
backend-66db8c4d9d-s4rjc    0/1     Terminating   0          84s
backend-7d8bdf547-972qs     1/1     Running       0          3m27s
backend-7d8bdf547-n75jn     1/1     Running       0          3m21s
```

Bozuk pod `Terminating` oldu, sağlıklı iki pod (v2) çalışmaya devam etti. Rollback ~1 dakikada tamamlandı.

## Öğrenilen Ders

Rollback sırasında şu uyarı çıktı:

```
Warning: resource deployments/backend was previously managed with 'kubectl apply'.
Rolling back will not update the kubectl.kubernetes.io/last-applied-configuration
annotation, which may cause unexpected behavior on future 'kubectl apply' operations.
```

Bu, `kubectl apply -f` (declarative) ile `kubectl set image` (imperative) komutlarını karıştırınca ortaya çıkan tipik bir durumdur. Bu proje demo amaçlı hızlı test için `kubectl set image` kullandı; gerçek bir üretim ortamında imaj güncellemesi de manifest dosyasındaki `image:` alanı değiştirilip `kubectl apply -f` ile yapılmalı — böylece `kubectl` her zaman tek bir "doğruluk kaynağı" (source of truth) ile çalışır ve bu tür annotation tutarsızlıkları oluşmaz.

## Sonuç

| Test | Sonuç |
|---|---|
| Rolling update sırasında kesinti | Yok (sürekli `200`) |
| Bozuk imaj deploy edilince kesinti | Yok — eski pod'lar ayakta kaldı |
| Rollback süresi | ~1 dakika |
| Kullanıcı etkisi | Sıfır — hiçbir istek başarısız olmadı |
