#!/usr/bin/env bash
# Lokal kind cluster'ı ingress-nginx ile ayağa kaldırır.
# Kullanım: ./scripts/kind-up.sh
set -euo pipefail

CLUSTER_NAME="todo"

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  echo "Cluster '$CLUSTER_NAME' zaten var, atlanıyor."
else
  cat <<EOF | kind create cluster --name "$CLUSTER_NAME" --config=-
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
  - containerPort: 443
    hostPort: 443
EOF
fi

echo "ingress-nginx kuruluyor..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "Controller'ın hazır olması bekleniyor..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

echo ""
echo "Cluster hazır. Şunu /etc/hosts dosyanıza eklemeyi unutmayın:"
echo "  127.0.0.1 todo.local"
echo "  (sudo nano /etc/hosts ile açıp satırı ekleyebilirsiniz)"
