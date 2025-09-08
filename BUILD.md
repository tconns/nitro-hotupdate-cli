# Build & Publish Guide

## 🚀 Quick Build

```powershell
# Build project
npm run build

# Test CLI
node dist/index.js --help
```

## 📦 Build for Publication

```powershell
# Using PowerShell script (recommended)
.\publish.ps1

# Or manually
npm run clean
npm run build
npm pack --dry-run
```

## 🌐 Publish to NPM

```bash
# Login to npm (first time only)
npm login

# Publish
npm publish

# Or publish with tag
npm publish --tag beta
```

## 🔧 Local Testing

```bash
# Install globally from local
npm install -g .

# Test
nitro-hotupdate --help
nitro-hotupdate build

# Uninstall
npm uninstall -g nitro-hotupdate-cli
```

## 📋 Pre-publish Checklist

- [ ] Code builds without errors
- [ ] CLI commands work correctly
- [ ] Version updated in package.json
- [ ] README.md updated
- [ ] No test files in dist/
- [ ] All dependencies correct

## 🎯 Features Ready

✅ SHA256 Integrity Check  
✅ Bundle Builder with hash verification  
✅ Cross-platform support (iOS/Android)  
✅ Interactive CLI  
✅ Manifest generation with security hashes  

## 🔐 Security Features

- **SHA256 Hash**: Bundle và assets được hash với SHA256
- **Integrity Verification**: Kiểm tra tính toàn vẹn file
- **Backward Compatible**: Vẫn giữ legacy hash
- **Client Examples**: Có sẵn code Android (Kotlin) và iOS (Swift)