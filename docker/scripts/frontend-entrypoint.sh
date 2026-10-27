#!/bin/sh
set -e

needs_install=0

if [ ! -d node_modules/@angular/core ]; then
  needs_install=1
elif [ ! -f node_modules/@angular/cli/package.json ] || [ ! -s node_modules/@angular/cli/package.json ]; then
  echo "⚠️ node_modules corrompu détecté"
  needs_install=1
fi

if [ "$needs_install" = "1" ]; then
  echo "📦 Installation des dépendances frontend (peut prendre 2-3 min)..."
  if [ -d node_modules ]; then
    echo "🔧 Nettoyage du dossier node_modules existant..."
    find node_modules -mindepth 1 -depth -exec rm -rf {} + || true
  fi
  npm ci
fi

mkdir -p /app/.angular/cache

echo "🚀 Démarrage du frontend Angular..."
exec npm start -- --host 0.0.0.0 --port 4200 --poll 2000
