# LogoIntershipKubernets_ToDo

# Kubernetes Todo App


Basit bir Todo uygulamasını Docker ve Kubernetes kullanarak dağıtma projesi.


## Proje Amacı


Bu projenin amacı Kubernetes'in temel bileşenlerini öğrenmek ve uygulamaktır.


Kullanılan Kubernetes kaynakları:


- Deployment

- Service

- Replica Set

- Pod

- Rolling Update

- Scaling


---


## Mimari


```text

+------------+

|  Frontend  |

|   React    |

+------------+

      |

      v

+------------+

|  Backend   |

| Node.js    |

+------------+

      |

      v

+------------+

|  MongoDB   |

+------------+

```


---


## Teknolojiler


### Frontend


- React


### Backend


- Node.js

- Express


### Veritabanı


- MongoDB


### Containerization


- Docker


### Orchestration


- Kubernetes


---


## Proje Yapısı


```text

todo-k8s/

│

├── frontend/

│   ├── Dockerfile

│   └── src/

│

├── backend/

│   ├── Dockerfile

│   └── server.js

│

└── k8s/

    ├── mongodb.yaml

    ├── backend.yaml

    └── frontend.yaml

```


---


## Kurulum


### Repository'i Klonla


```bash

git clone <repo-url>


cd todo-k8s

```


---


## Docker Image Oluşturma


### Backend


```bash

docker build -t todo-backend ./backend

```


### Frontend


```bash

docker build -t todo-frontend ./frontend

```


---


## Kubernetes Deployment


### MongoDB


```bash

kubectl apply -f k8s/mongodb.yaml

```


### Backend


```bash

kubectl apply -f k8s/backend.yaml

```


### Frontend


```bash

kubectl apply -f k8s/frontend.yaml

```


---


## Pod Kontrolü


```bash

kubectl get pods

```


Örnek çıktı:


```bash

NAME                        READY   STATUS

frontend-xxx                1/1     Running

frontend-yyy                1/1     Running

backend-xxx                 1/1     Running

backend-yyy                 1/1     Running

mongodb-xxx                 1/1     Running

```


---


## Service Kontrolü


```bash

kubectl get svc

```


Örnek çıktı:


```bash

NAME                TYPE

frontend-service    LoadBalancer

backend-service     ClusterIP

mongodb-service     ClusterIP

```


---


## Ölçekleme (Scaling)


Backend pod sayısını artır:


```bash

kubectl scale deployment backend --replicas=5

```


Kontrol:


```bash

kubectl get pods

```


---


## Rolling Update


Yeni image oluştur:


```bash

docker build -t todo-backend:v2 ./backend

```


Deployment güncelle:


```bash

kubectl set image deployment/backend backend=todo-backend:v2

```


Durum kontrolü:


```bash

kubectl rollout status deployment/backend

```


---


## Kullanılan Kubernetes Kaynakları


### Deployment


Uygulama podlarının yönetimini sağlar.


### Service


Podlar arasında iletişim kurulmasını sağlar.


### Replica


Servisin yüksek erişilebilirliğini sağlar.


### Rolling Update


Uygulamanın kesintisiz güncellenmesini sağlar.


---


## Öğrenilen Konular


- Docker Image oluşturma

- Container çalıştırma

- Kubernetes Deployment

- Kubernetes Service

- Pod yönetimi

- Replica Scaling

- Rolling Update

- Mikro servis mimarisi temelleri


---


## CV Açıklaması


Docker ile containerize edilmiş React, Node.js ve MongoDB tabanlı Todo uygulamasını Kubernetes üzerinde dağıttım. Deployment, Service ve Replica yönetimini gerçekleştirerek uygulamanın ölçeklenebilirliğini test ettim. Rolling Update mekanizması ile kesintisiz sürüm güncellemeleri uyguladım.


---


## Ekran Görüntüleri


### Pod Listesi


images/pods.png


### Service Listesi


images/services.png


### Uygulama


images/app.png

 
 
