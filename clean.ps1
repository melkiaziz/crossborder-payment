Write-Host "🧹 Nettoyage du projet Angular..." -ForegroundColor Yellow

# Arrêter le processus ng serve
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Supprimer les caches
Remove-Item -Recurse -Force .angular -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Réinstaller les dépendances
npm cache clean --force
npm install

Write-Host "✅ Nettoyage terminé !" -ForegroundColor Green
Write-Host "🚀 Lance 'ng serve' pour démarrer" -ForegroundColor Cyan
