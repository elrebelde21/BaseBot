echo "Iniciando... ⚙️"

# Verifica si TypeScript está instalado local
if [ ! -f "./node_modules/.bin/tsc" ]; then
  echo "❌ No se encontró TypeScript. Ejecutá: npm install -D typescript"
  exit 1
fi

echo "🔧 Compilando..."
npx tsc

if [ ! -f "dist/index.js" ]; then
  echo "❌ Error: dist/index.js no se generó. ¿Hubo errores al compilar?"
  exit 1
fi

echo "🚀 Ejecutando..."
node dist/index.js
