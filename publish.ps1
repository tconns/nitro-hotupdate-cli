# PowerShell script to build and publish nitro-hotupdate-cli

Write-Host "🚀 Building nitro-hotupdate-cli for publication..." -ForegroundColor Green

# Clean previous build
Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

# Build the project
Write-Host "📦 Building TypeScript project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Remove any test files from dist
Write-Host "🧹 Cleaning test files from dist..." -ForegroundColor Yellow
Get-ChildItem -Path "dist" -Recurse -Filter "*.test.js" | Remove-Item -Force
Get-ChildItem -Path "dist" -Recurse -Filter "*.spec.js" | Remove-Item -Force

# Test the CLI
Write-Host "🔍 Testing CLI functionality..." -ForegroundColor Yellow
node dist/index.js --version

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CLI test failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Package contents:" -ForegroundColor Cyan
npm pack --dry-run

Write-Host ""
Write-Host "🎯 Ready to publish!" -ForegroundColor Green
Write-Host "To publish to npm, run:" -ForegroundColor Cyan
Write-Host "  npm publish" -ForegroundColor White
Write-Host ""
Write-Host "To test locally, run:" -ForegroundColor Cyan
Write-Host "  npm install -g ." -ForegroundColor White
Write-Host "  nitro-hotupdate --help" -ForegroundColor White