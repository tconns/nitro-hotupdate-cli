# 🔐 Digital Signature Feature - User Guide

## Overview
Nitro Hot Update CLI now supports digital signature verification for enhanced security. This feature provides **Authenticity Check** in addition to the existing **Integrity Check** (SHA256).

## Security Layers

### 1. Integrity Check (SHA256)
- **Purpose**: Ensures files haven't been corrupted during transfer
- **Implementation**: SHA256 hashes for bundle and assets
- **Always Active**: Enabled by default for all builds

### 2. Authenticity Check (Digital Signature)
- **Purpose**: Ensures files haven't been tampered with and come from trusted source
- **Implementation**: RSA-SHA256 or ECDSA-SHA256 digital signatures
- **Optional**: Can be enabled/disabled during build

## Usage Guide

### Interactive Build

```bash
node dist/index.js build --project-path /path/to/your/project
```

When prompted:
1. **Enable digital signature verification?** → Choose `Yes`
2. **Choose signature algorithm** → `RSA-SHA256` (recommended) or `ECDSA-SHA256`
3. **Choose key option**:
   - **Auto-generate new key pair** → CLI creates new keys automatically
   - **Use existing private key** → Specify path to your private key file

### CI/CD Build

```bash
node dist/index.js build-ci \
  --project-path /path/to/project \
  --platforms android,ios \
  --signature \
  --signature-algorithm RSA-SHA256 \
  --private-key ./keys/my_private.pem
```

If private key doesn't exist, it will be auto-generated.

## Key Management Commands

### Generate New Key Pair

```bash
# Generate RSA-SHA256 keys (recommended)
node dist/index.js signature generate-keys --algorithm RSA-SHA256 --output ./keys

# Generate ECDSA-SHA256 keys
node dist/index.js signature generate-keys --algorithm ECDSA-SHA256 --output ./keys
```

### Sign Existing Manifest

```bash
node dist/index.js signature sign \
  --manifest ./hotupdate-build/android/manifest.json \
  --private-key ./keys/hotupdate_private.pem
```

### Verify Signature

```bash
# Using embedded public key in manifest
node dist/index.js signature verify --manifest ./manifest.json

# Using external public key file
node dist/index.js signature verify \
  --manifest ./manifest.json \
  --public-key ./keys/hotupdate_public.pem
```

## Manifest Structure

### Without Signature (Integrity Only)
```json
{
  "version": "1.0.0",
  "platform": "android",
  "bundleSHA256": "sha256:abc123...",
  "assets": [
    {
      "name": "logo.png",
      "sha256": "def456...",
      // ... other fields
    }
  ],
  // ... other fields
}
```

### With Signature (Integrity + Authenticity)
```json
{
  "version": "1.0.0",
  "platform": "android",
  "bundleSHA256": "sha256:abc123...",
  "assets": [
    {
      "name": "logo.png", 
      "sha256": "def456...",
      // ... other fields
    }
  ],
  // ... other fields
  "signature": "RSA-SHA256:MEUCIQC...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "signatureTimestamp": 1234567890
}
```

## Best Practices

### Key Security
- **Keep private keys secure** and never commit to version control
- **Back up keys** in a secure location
- **Rotate keys periodically** for enhanced security
- **Use different keys** for different environments (dev/staging/prod)

### Implementation
- **Enable signature** for production builds
- **Test verification** in your React Native app before deployment
- **Implement fallback** logic in case signature verification fails
- **Log verification results** for monitoring

### CI/CD Integration
```bash
# Example GitHub Actions step
- name: Build Hot Update with Signature
  run: |
    node dist/index.js build-ci \
      --project-path . \
      --platforms android,ios \
      --version ${{ github.run_number }} \
      --signature \
      --private-key ${{ secrets.HOTUPDATE_PRIVATE_KEY_PATH }}
```

## Client-Side Verification (React Native)

```javascript
import crypto from 'crypto';

async function verifyHotUpdateManifest(manifest, publicKeyPem) {
  try {
    // Extract signature and recreate canonical manifest
    const { signature, publicKey, signatureTimestamp, ...manifestData } = manifest;
    
    if (!signature) {
      console.log('No signature found, skipping verification');
      return true; // Allow unsigned manifests
    }
    
    // Parse signature format: "RSA-SHA256:base64signature"
    const [algorithm, signatureBase64] = signature.split(':', 2);
    const hashAlgorithm = algorithm.split('-')[1]; // SHA256
    
    // Create canonical JSON (sorted keys)
    const canonicalManifest = JSON.stringify(manifestData, Object.keys(manifestData).sort());
    
    // Verify signature
    const verify = crypto.createVerify(hashAlgorithm);
    verify.update(canonicalManifest);
    
    const isValid = verify.verify(
      publicKeyPem || publicKey, 
      Buffer.from(signatureBase64, 'base64')
    );
    
    if (isValid) {
      console.log('✅ Signature verification successful');
      return true;
    } else {
      console.error('❌ Signature verification failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// Usage
const manifest = await fetch('https://your-server.com/manifest.json').then(r => r.json());
const isVerified = await verifyHotUpdateManifest(manifest);

if (isVerified) {
  // Proceed with hot update
  console.log('Manifest verified, applying hot update...');
} else {
  // Handle verification failure
  console.log('Verification failed, skipping hot update');
}
```

## Troubleshooting

### Common Issues

1. **"Private key not found"**
   - Solution: Choose "Auto-generate" option or provide correct key path

2. **"Signature verification failed"**
   - Check if manifest was modified after signing
   - Ensure correct public key is being used
   - Verify signature algorithm matches

3. **"Algorithm not supported"**
   - Use RSA-SHA256 or ECDSA-SHA256 only
   - Check Node.js crypto module support

### Debug Commands

```bash
# Check if keys exist
ls -la ./keys/

# Verify manifest structure
cat ./hotupdate-build/android/manifest.json | jq .signature

# Test signature verification
node dist/index.js signature verify --manifest ./manifest.json
```

## Migration Guide

### From SHA256-only to Signature Support

1. **Existing builds** continue to work (backward compatible)
2. **New builds** can optionally enable signature
3. **Client apps** should implement signature verification with fallback
4. **Gradual rollout** recommended (start with staging environment)

### Example Migration Steps

1. Update CLI to latest version
2. Generate production keys: `node dist/index.js signature generate-keys`
3. Test with staging environment
4. Update React Native app to verify signatures
5. Enable signature for production builds
6. Monitor verification success rates

## Summary

The digital signature feature provides an additional security layer while maintaining backward compatibility. It's recommended for production environments where authenticity verification is critical.

**Key Benefits:**
- 🔐 **Enhanced Security**: Authenticity verification prevents tampering
- 🔄 **Backward Compatible**: Works with existing SHA256-only manifests  
- 🛠️ **Flexible**: Optional feature, auto-key generation
- 📱 **Client-Ready**: Easy integration in React Native apps