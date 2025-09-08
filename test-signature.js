#!/usr/bin/env node

/**
 * Test script to demonstrate signature feature
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Nitro Hot Update CLI Signature Feature\n');

const projectPath = 'D:\\rnma';
const outputPath = './test-signature-build';

// Clean up previous test
if (fs.existsSync(outputPath)) {
  console.log('🧹 Cleaning up previous test...');
  fs.rmSync(outputPath, { recursive: true, force: true });
}

console.log('🔐 Testing with signature ENABLED...\n');

// Test with signature enabled
const buildWithSignature = `node dist/index.js build-ci --project-path "${projectPath}" --platforms android --version 1.0.0 --output "${outputPath}" --signature --signature-algorithm RSA-SHA256 --private-key "./test-keys/test_private.pem"`;

try {
  // First, let's generate test keys
  console.log('🔑 Generating test keys...');
  execSync('node dist/index.js signature generate-keys --output "./test-keys" --name "test"', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n🏗️ Building with signature...');
  execSync(buildWithSignature, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // Check if signature was added
  const manifestPath = path.join(outputPath, 'android', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    console.log('\n📋 Signature Test Results:');
    console.log(`✅ Manifest generated: ${manifestPath}`);
    console.log(`✅ Has signature: ${!!manifest.signature}`);
    console.log(`✅ Has publicKey: ${!!manifest.publicKey}`);
    console.log(`✅ Has signatureTimestamp: ${!!manifest.signatureTimestamp}`);
    
    if (manifest.signature) {
      console.log(`✅ Signature algorithm: ${manifest.signature.split(':')[0]}`);
      console.log(`✅ Signature preview: ${manifest.signature.substring(0, 50)}...`);
    }
  }
  
  // Verify signature
  console.log('\n🔍 Verifying signature...');
  execSync(`node dist/index.js signature verify --manifest "${manifestPath}"`, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ Signature test completed successfully!');
  
} catch (error) {
  console.error('❌ Signature test failed:', error.message);
  process.exit(1);
}

console.log('\n🧹 Cleaning up test files...');
// Clean up
if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { recursive: true, force: true });
}
if (fs.existsSync('./test-keys')) {
  fs.rmSync('./test-keys', { recursive: true, force: true });
}

console.log('🎉 All tests completed!');