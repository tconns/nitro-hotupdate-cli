# 🧪 Testing Guide - Nitro Hot Update CLI

## Overview
Hướng dẫn test đầy đủ tất cả các lệnh và tính năng của Nitro Hot Update CLI. File này giúp bạn test systematically và verify tất cả functionalities.

## Prerequisites

### Setup Test Environment
```bash
# 1. Clone và setup project
git clone <repository-url>
cd nitro-hotupdate-cli
npm install

# 2. Build project
npm run build

# 3. Chuẩn bị React Native test project (thay đổi path phù hợp)
# Ví dụ: D:\rnma hoặc /path/to/your/react-native-project
export RN_TEST_PROJECT="D:\rnma"  # Windows
# export RN_TEST_PROJECT="/path/to/rn-project"  # Linux/macOS
```

### Test Data Structure
```
nitro-hotupdate-cli/
├── test-outputs/              # Test build outputs
├── test-configs/              # Test configuration files  
├── test-keys/                 # Test signature keys
└── logs/                      # Test logs
```

## 🔄 Test Categories

### 1. Interactive Build Tests

#### Test 1.1: Interactive Build WITHOUT Signature
```bash
# Objective: Test interactive build với signature disabled
echo "🧪 Test 1.1: Interactive Build (No Signature)"

# Command
node dist/index.js build --project-path $RN_TEST_PROJECT

# User Input Sequence:
# ✅ Which platforms? → iOS, Android (hoặc chỉ Android để nhanh)
# ✅ Version? → Use current version
# ✅ Bundle name? → index
# ✅ Output directory? → ./test-outputs/interactive-nosig
# ✅ Source maps? → No
# ✅ Minify? → Yes
# ✅ Enable signature? → No  ← KEY: Chọn No
# ✅ Proceed? → Yes

# Expected Results:
# ✅ Build successful
# ✅ ZIP files created in ./test-outputs/interactive-nosig/
# ✅ manifest.json KHÔNG có: signature, publicKey, signatureTimestamp
# ✅ manifest.json CÓ: bundleSHA256, assets[].sha256 (integrity only)
```

#### Test 1.2: Interactive Build WITH Signature (Auto-generate)
```bash
# Objective: Test interactive build với signature enabled và auto-generate keys
echo "🧪 Test 1.2: Interactive Build (With Signature - Auto-generate)"

# Command
node dist/index.js build --project-path $RN_TEST_PROJECT

# User Input Sequence:
# ✅ Which platforms? → Android
# ✅ Version? → Bump patch version
# ✅ Bundle name? → index
# ✅ Output directory? → ./test-outputs/interactive-sig-auto
# ✅ Source maps? → No
# ✅ Minify? → Yes
# ✅ Enable signature? → Yes  ← KEY: Chọn Yes
# ✅ Algorithm? → RSA-SHA256
# ✅ Key option? → Auto-generate new key pair  ← KEY: Auto-generate
# ✅ Proceed? → Yes

# Expected Results:
# ✅ Keys generated in ./test-outputs/interactive-sig-auto/keys/
# ✅ Build successful with signature info
# ✅ manifest.json CÓ: signature, publicKey, signatureTimestamp
# ✅ Signature verification successful
```

#### Test 1.3: Interactive Build WITH Signature (Existing Key)
```bash
# Objective: Test interactive build với existing private key
echo "🧪 Test 1.3: Interactive Build (With Signature - Existing Key)"

# Preparation: Generate keys first
mkdir -p ./test-keys
node dist/index.js signature generate-keys --output ./test-keys --name test

# Command
node dist/index.js build --project-path $RN_TEST_PROJECT

# User Input Sequence:
# ✅ Which platforms? → Android
# ✅ Version? → Use current version
# ✅ Bundle name? → index
# ✅ Output directory? → ./test-outputs/interactive-sig-existing
# ✅ Source maps? → No
# ✅ Minify? → Yes
# ✅ Enable signature? → Yes
# ✅ Algorithm? → RSA-SHA256
# ✅ Key option? → Use existing private key  ← KEY: Existing
# ✅ Private key path? → ./test-keys/test_private.pem
# ✅ Proceed? → Yes

# Expected Results:
# ✅ Uses existing keys from ./test-keys/
# ✅ Build successful
# ✅ Signature verification successful
```

### 2. Configuration File Tests

#### Test 2.1: Generate and Validate Config
```bash
# Objective: Test config file generation và validation
echo "🧪 Test 2.1: Config Generation and Validation"

# Generate default config
node dist/index.js config init --output ./test-configs/default.config.json

# Expected Results:
# ✅ File created: ./test-configs/default.config.json
# ✅ Contains all required fields

# Validate generated config
node dist/index.js config validate --config ./test-configs/default.config.json

# Expected Results:
# ✅ Validation successful
# ✅ Shows configuration summary
```

#### Test 2.2: Config Build WITHOUT Signature
```bash
# Objective: Test config build với signature disabled
echo "🧪 Test 2.2: Config Build (No Signature)"

# Create config file
cat > ./test-configs/nosig.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["android"],
    "version": "2.0.1",
    "outputPath": "./test-outputs/config-nosig"
  },
  "signature": {
    "enabled": false
  },
  "metadata": {
    "description": "Test config without signature"
  }
}
EOF

# Validate config
node dist/index.js config validate --config ./test-configs/nosig.config.json

# Dry run
node dist/index.js build-config --config ./test-configs/nosig.config.json --dry-run

# Build
node dist/index.js build-config --config ./test-configs/nosig.config.json

# Expected Results:
# ✅ Validation successful
# ✅ Dry run shows "No signature"
# ✅ Build successful without signature
# ✅ manifest.json KHÔNG có signature fields
```

#### Test 2.3: Config Build WITH Signature (Auto-generate)
```bash
# Objective: Test config build với signature enabled và auto-generate
echo "🧪 Test 2.3: Config Build (With Signature - Auto-generate)"

# Create config file
cat > ./test-configs/sig-auto.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["android"],
    "version": "2.0.2",
    "outputPath": "./test-outputs/config-sig-auto"
  },
  "signature": {
    "enabled": true,
    "algorithm": "RSA-SHA256",
    "autoGenerate": true
  },
  "metadata": {
    "description": "Test config with auto-generated signature"
  }
}
EOF

# Build
node dist/index.js build-config --config ./test-configs/sig-auto.config.json

# Expected Results:
# ✅ Keys auto-generated in ./test-outputs/config-sig-auto/keys/
# ✅ Build successful with signature
# ✅ manifest.json CÓ signature fields
```

#### Test 2.4: Config Build WITH Signature (Existing Key)
```bash
# Objective: Test config build với existing private key
echo "🧪 Test 2.4: Config Build (With Signature - Existing Key)"

# Create config file (using keys from Test 1.3)
cat > ./test-configs/sig-existing.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["android"],
    "version": "2.0.3",
    "outputPath": "./test-outputs/config-sig-existing"
  },
  "signature": {
    "enabled": true,
    "algorithm": "RSA-SHA256",
    "privateKeyPath": "./test-keys/test_private.pem",
    "autoGenerate": false
  }
}
EOF

# Build
node dist/index.js build-config --config ./test-configs/sig-existing.config.json

# Expected Results:
# ✅ Uses existing key from ./test-keys/
# ✅ Build successful
# ✅ Signature verification successful
```

### 3. CI/CD Build Tests

#### Test 3.1: CI Build WITHOUT Signature
```bash
# Objective: Test CI build command với minimal parameters
echo "🧪 Test 3.1: CI Build (No Signature)"

# Command
node dist/index.js build-ci \
  --project-path $RN_TEST_PROJECT \
  --platforms android \
  --version 3.0.1 \
  --output ./test-outputs/ci-nosig \
  --bundle-name index \
  --no-minify

# Expected Results:
# ✅ Build successful without prompts
# ✅ No signature fields in manifest
# ✅ Bundle not minified (--no-minify)
```

#### Test 3.2: CI Build WITH Signature
```bash
# Objective: Test CI build với signature enabled
echo "🧪 Test 3.2: CI Build (With Signature)"

# Command
node dist/index.js build-ci \
  --project-path $RN_TEST_PROJECT \
  --platforms android \
  --version 3.0.2 \
  --output ./test-outputs/ci-sig \
  --signature \
  --signature-algorithm RSA-SHA256 \
  --private-key ./test-keys/test_private.pem

# Expected Results:
# ✅ Build successful with signature
# ✅ Uses specified private key
# ✅ manifest.json có signature fields
```

### 4. Signature Management Tests

#### Test 4.1: Key Generation
```bash
# Objective: Test key generation commands
echo "🧪 Test 4.1: Key Generation"

# RSA-SHA256 keys
node dist/index.js signature generate-keys \
  --algorithm RSA-SHA256 \
  --key-size 2048 \
  --output ./test-keys/rsa \
  --name rsa-test

# ECDSA-SHA256 keys  
node dist/index.js signature generate-keys \
  --algorithm ECDSA-SHA256 \
  --key-size 256 \
  --output ./test-keys/ecdsa \
  --name ecdsa-test

# Expected Results:
# ✅ RSA keys generated: ./test-keys/rsa/rsa-test_private.pem, rsa-test_public.pem
# ✅ ECDSA keys generated: ./test-keys/ecdsa/ecdsa-test_private.pem, ecdsa-test_public.pem
# ✅ Different key sizes and algorithms work
```

#### Test 4.2: Manual Signing
```bash
# Objective: Test manual manifest signing
echo "🧪 Test 4.2: Manual Signing"

# Use manifest from previous test
MANIFEST_PATH="./test-outputs/ci-nosig/android/manifest.json"

# Sign manifest
node dist/index.js signature sign \
  --manifest $MANIFEST_PATH \
  --private-key ./test-keys/rsa/rsa-test_private.pem

# Expected Results:
# ✅ Manifest signed successfully
# ✅ Signature, publicKey, signatureTimestamp added to manifest
```

#### Test 4.3: Signature Verification
```bash
# Objective: Test signature verification
echo "🧪 Test 4.3: Signature Verification"

# Verify with embedded public key
node dist/index.js signature verify \
  --manifest ./test-outputs/config-sig-auto/android/manifest.json

# Verify with external public key
node dist/index.js signature verify \
  --manifest ./test-outputs/ci-sig/android/manifest.json \
  --public-key ./test-keys/test_public.pem

# Expected Results:
# ✅ Both verifications successful
# ✅ Shows algorithm and timestamp info
```

### 5. Error Handling Tests

#### Test 5.1: Invalid Configurations
```bash
# Objective: Test error handling với invalid configs
echo "🧪 Test 5.1: Error Handling"

# Invalid project path
cat > ./test-configs/invalid-path.config.json << 'EOF'
{
  "project": {
    "path": "/nonexistent/path"
  },
  "build": {
    "platforms": ["android"],
    "outputPath": "./test-outputs/error-test"
  }
}
EOF

# Test validation (should fail)
node dist/index.js config validate --config ./test-configs/invalid-path.config.json

# Invalid platform
cat > ./test-configs/invalid-platform.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["windows"],
    "outputPath": "./test-outputs/error-test"
  }
}
EOF

# Test validation (should fail)
node dist/index.js config validate --config ./test-configs/invalid-platform.config.json

# Expected Results:
# ❌ Validation fails with clear error messages
# ❌ No builds proceed with invalid configs
```

#### Test 5.2: Missing Private Key
```bash
# Objective: Test behavior when private key missing
echo "🧪 Test 5.2: Missing Private Key Handling"

# Config with non-existent private key
cat > ./test-configs/missing-key.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["android"],
    "version": "2.0.5",
    "outputPath": "./test-outputs/missing-key-test"
  },
  "signature": {
    "enabled": true,
    "privateKeyPath": "./nonexistent/key.pem",
    "autoGenerate": false
  }
}
EOF

# Build (should auto-generate despite missing key)
node dist/index.js build-config --config ./test-configs/missing-key.config.json

# Expected Results:
# ⚠️ Warning about missing key
# ✅ Auto-generates new keys
# ✅ Build completes successfully
```

### 6. Advanced Feature Tests

#### Test 6.1: Multiple Platforms
```bash
# Objective: Test build với multiple platforms
echo "🧪 Test 6.1: Multiple Platforms"

# Config for both iOS and Android
cat > ./test-configs/multi-platform.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["ios", "android"],
    "version": "3.1.0",
    "outputPath": "./test-outputs/multi-platform"
  },
  "signature": {
    "enabled": true,
    "autoGenerate": true
  }
}
EOF

# Build
node dist/index.js build-config --config ./test-configs/multi-platform.config.json

# Expected Results:
# ✅ Both iOS and Android builds successful
# ✅ Separate ZIP files for each platform
# ✅ Both manifests signed with same keys
```

#### Test 6.2: Source Maps and Development Build
```bash
# Objective: Test development build với source maps
echo "🧪 Test 6.2: Development Build"

# Config for development
cat > ./test-configs/development.config.json << 'EOF'
{
  "project": {
    "path": "$RN_TEST_PROJECT"
  },
  "build": {
    "platforms": ["android"],
    "version": "dev-1.0.0",
    "outputPath": "./test-outputs/development",
    "sourcemap": true,
    "minify": false
  },
  "signature": {
    "enabled": false
  },
  "metadata": {
    "description": "Development build with source maps"
  }
}
EOF

# Build
node dist/index.js build-config --config ./test-configs/development.config.json

# Expected Results:
# ✅ Source map files generated (.map files)
# ✅ Bundle not minified (larger size)
# ✅ Development-friendly build
```

### 7. Integration Tests

#### Test 7.1: End-to-End Workflow
```bash
# Objective: Test complete workflow from config creation to verification
echo "🧪 Test 7.1: End-to-End Workflow"

# Step 1: Generate config
node dist/index.js config init --output ./test-configs/e2e.config.json

# Step 2: Customize config for test project
sed -i 's|"./"|"'$RN_TEST_PROJECT'"|g' ./test-configs/e2e.config.json
sed -i 's|"./hotupdate-build"|"./test-outputs/e2e"|g' ./test-configs/e2e.config.json

# Step 3: Validate
node dist/index.js config validate --config ./test-configs/e2e.config.json

# Step 4: Dry run
node dist/index.js build-config --config ./test-configs/e2e.config.json --dry-run

# Step 5: Build
node dist/index.js build-config --config ./test-configs/e2e.config.json

# Step 6: Verify
node dist/index.js signature verify --manifest ./test-outputs/e2e/android/manifest.json

# Expected Results:
# ✅ All steps complete without errors
# ✅ Final verification successful
```

#### Test 7.2: Performance and Size Comparison
```bash
# Objective: Compare different build configurations
echo "🧪 Test 7.2: Performance Comparison"

# Minified vs Non-minified
echo "Building minified version..."
node dist/index.js build-ci --project-path $RN_TEST_PROJECT --platforms android --version perf-min --output ./test-outputs/perf-min --minify

echo "Building non-minified version..."
node dist/index.js build-ci --project-path $RN_TEST_PROJECT --platforms android --version perf-nomin --output ./test-outputs/perf-nomin --no-minify

# Compare sizes
echo "Size comparison:"
ls -lh ./test-outputs/perf-min/android/bundles/*.bundle
ls -lh ./test-outputs/perf-nomin/android/bundles/*.bundle
ls -lh ./test-outputs/perf-min/*.zip
ls -lh ./test-outputs/perf-nomin/*.zip

# Expected Results:
# ✅ Minified bundles significantly smaller
# ✅ Build times recorded
# ✅ Size differences documented
```

## 🔍 Verification Scripts

### Quick Test All Commands
```bash
#!/bin/bash
# File: test-all-commands.sh

echo "🧪 Testing All CLI Commands"

# Test help
echo "Testing help commands..."
node dist/index.js --help
node dist/index.js build --help
node dist/index.js signature --help
node dist/index.js config --help

# Test info
echo "Testing info command..."
node dist/index.js info --project-path $RN_TEST_PROJECT

# Test signature commands
echo "Testing signature commands..."
mkdir -p ./test-quick
node dist/index.js signature generate-keys --output ./test-quick --name quick-test
node dist/index.js signature verify --manifest ./test-outputs/config-sig-auto/android/manifest.json

# Test config commands  
echo "Testing config commands..."
node dist/index.js config init --output ./test-quick/quick.config.json --force
node dist/index.js config validate --config ./test-quick/quick.config.json

echo "✅ All command tests completed"
```

### Verification Checklist
```bash
#!/bin/bash
# File: verify-test-results.sh

echo "🔍 Verifying Test Results"

# Check build outputs exist
echo "Checking build outputs..."
ls -la ./test-outputs/*/android/manifest.json
ls -la ./test-outputs/*/*.zip

# Check signature fields in manifests
echo "Checking signature fields..."
echo "Manifests WITH signature:"
grep -l '"signature"' ./test-outputs/*/android/manifest.json || echo "None found"

echo "Manifests WITHOUT signature:"
grep -L '"signature"' ./test-outputs/*/android/manifest.json || echo "None found"

# Check key files
echo "Checking generated keys..."
find ./test-outputs/ -name "*_private.pem" -o -name "*_public.pem"
find ./test-keys/ -name "*.pem"

# Verify SHA256 hashes exist
echo "Checking SHA256 hashes..."
grep -c '"bundleSHA256"' ./test-outputs/*/android/manifest.json
grep -c '"sha256"' ./test-outputs/*/android/manifest.json

echo "✅ Verification completed"
```

## 📋 Test Matrix

| Test Case | Method | Signature | Expected Result |
|-----------|--------|-----------|----------------|
| Interactive - No Sig | Interactive | Disabled | ✅ No signature fields |
| Interactive - Auto Sig | Interactive | Auto-gen | ✅ Signed with generated keys |
| Interactive - Existing Sig | Interactive | Existing key | ✅ Signed with existing key |
| Config - No Sig | Config file | Disabled | ✅ No signature fields |
| Config - Auto Sig | Config file | Auto-gen | ✅ Signed with generated keys |
| Config - Existing Sig | Config file | Existing key | ✅ Signed with existing key |
| CI - No Sig | Command line | Disabled | ✅ No signature fields |
| CI - With Sig | Command line | Specified key | ✅ Signed with specified key |

## 🚀 Quick Start Testing

### Minimal Test Suite (5 minutes)
```bash
# Setup
export RN_TEST_PROJECT="D:\rnma"  # Adjust path
mkdir -p test-outputs test-configs test-keys

# Test 1: Basic interactive build (no signature)
echo "Test 1: Interactive build without signature"
# Run: node dist/index.js build --project-path $RN_TEST_PROJECT
# Choose: Android, current version, ./test-outputs/quick1, No signature

# Test 2: Config build with signature
echo "Test 2: Config build with signature"
node dist/index.js config init --output test-configs/quick.config.json
# Edit config to point to your RN project and enable signature
node dist/index.js build-config --config test-configs/quick.config.json

# Test 3: Verify signature
echo "Test 3: Verify signature"
node dist/index.js signature verify --manifest test-outputs/quick1/android/manifest.json

echo "✅ Quick tests completed"
```

### Full Test Suite (30 minutes)
```bash
# Run all tests in sequence
for test in {1..7}; do
  echo "Running Test Category $test..."
  # Execute all tests in category $test
done

# Generate test report
echo "📊 Test Summary Report" > test-report.md
echo "Generated: $(date)" >> test-report.md
echo "Total builds: $(ls test-outputs/ | wc -l)" >> test-report.md
echo "Signed manifests: $(grep -l signature test-outputs/*/android/manifest.json | wc -l)" >> test-report.md
echo "Unsigned manifests: $(grep -L signature test-outputs/*/android/manifest.json | wc -l)" >> test-report.md
```

## 📝 Notes

- **Adjust paths**: Thay đổi `$RN_TEST_PROJECT` thành path của React Native project của bạn
- **Platform selection**: Chọn Android only để test nhanh hơn
- **Clean up**: Xóa `test-outputs/` folder sau khi test xong để save space
- **Performance**: Run tests tuần tự để avoid resource conflicts
- **Debugging**: Check `logs/` folder nếu có issues

Có thể copy từng test case và run độc lập để debug issues. Happy testing! 🎯