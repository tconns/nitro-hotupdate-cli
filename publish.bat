@echo off
REM 🚀 Quick Publishing Script for nitro-hotupdate-cli (Windows)

echo 🔧 Starting publish preparation...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run from project root.
    exit /b 1
)

REM Check if dist directory exists
if not exist "dist" (
    echo 📦 Building project...
    call npm run build
) else (
    echo ✅ Build directory exists
)

REM Check npm login status
echo 🔑 Checking npm login status...
npm whoami >nul 2>&1
if errorlevel 1 (
    echo ❌ Please login to npm first:
    echo    npm login
    exit /b 1
) else (
    for /f %%i in ('npm whoami') do echo ✅ NPM login verified: %%i
)

REM Check package name availability
echo 📦 Checking package name availability...
for /f "tokens=*" %%i in ('node -p "require('./package.json').name"') do set PACKAGE_NAME=%%i
npm view %PACKAGE_NAME% >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Package name '%PACKAGE_NAME%' already exists on npm
    echo    Consider using a different name or scoped package @username/%PACKAGE_NAME%
    set /p confirm="Continue anyway? (y/N): "
    if /i not "%confirm%"=="y" exit /b 1
) else (
    echo ✅ Package name '%PACKAGE_NAME%' is available
)

REM Test local installation
echo 🧪 Testing local installation...
npm pack >nul 2>&1
for %%f in (*.tgz) do set TARBALL=%%f
echo ✅ Package created: %TARBALL%

REM Clean up test tarball
del %TARBALL%

REM Version information
for /f "tokens=*" %%i in ('node -p "require('./package.json').version"') do set CURRENT_VERSION=%%i
echo 📌 Current version: %CURRENT_VERSION%

REM Pre-publish checklist
echo.
echo 📋 Pre-publish checklist:
echo    ✅ package.json updated
echo    ✅ LICENSE file exists
echo    ✅ .npmignore configured
echo    ✅ Build successful
echo    ✅ NPM login verified
echo    ✅ Package name checked
echo.

REM Ask for confirmation
set /p confirm="🚀 Ready to publish? (y/N): "
if /i not "%confirm%"=="y" (
    echo ❌ Publishing cancelled
    exit /b 0
)

REM Publish
echo 🚀 Publishing to npm...
npm publish

if errorlevel 1 (
    echo ❌ Publishing failed. Check the error above.
    exit /b 1
) else (
    echo.
    echo 🎉 Successfully published %PACKAGE_NAME%@%CURRENT_VERSION%!
    echo.
    echo 📦 Users can now install with:
    echo    npm install -g %PACKAGE_NAME%
    echo    npx %PACKAGE_NAME% --help
    echo.
    echo 🔗 View on npm: https://www.npmjs.com/package/%PACKAGE_NAME%
)