# 📱 Hot Update Deployment Guide

## 🎯 Tổng quan triển khai

Sau khi CLI tạo ra file ZIP hot update bundle, việc triển khai cần phải đặt bundle và assets ở vị trí chính xác để React Native có thể load được.

## 📁 Cấu trúc thư mục trong App

### **1. Android App Structure:**

```
/data/data/com.yourapp/files/  (hoặc getFilesDir())
├── hotupdate/
│   └── android/
│       ├── v1.0.1/
│       │   ├── bundles/
│       │   │   └── index.android.bundle
│       │   ├── assets/
│       │   │   ├── drawable-mdpi/
│       │   │   │   ├── src_assets_images_1.png
│       │   │   │   ├── src_assets_images_2.png
│       │   │   │   └── ...
│       │   │   ├── drawable-xhdpi/
│       │   │   ├── drawable-xxhdpi/
│       │   │   ├── drawable-xxxhdpi/
│       │   │   └── raw/
│       │   │       └── keep.xml
│       │   └── manifest.json
│       └── v1.0.2/
│           └── ... (same structure)
└── hotupdate-cache/
    ├── pending/
    ├── active/
    └── backup/
```

### **2. iOS App Structure:**

```
Documents/  (NSDocumentDirectory)
├── hotupdate/
│   └── ios/
│       ├── v1.0.1/
│       │   ├── bundles/
│       │   │   └── index.ios.bundle
│       │   ├── assets/
│       │   │   ├── src_assets_images_1.png
│       │   │   ├── src_assets_images_2.png
│       │   │   └── ...
│       │   └── manifest.json
│       └── v1.0.2/
│           └── ... (same structure)
└── hotupdate-cache/
    ├── pending/
    ├── active/
    └── backup/
```

## 🔧 Implementation Steps

### **Step 1: Giải nén ZIP vào pending directory**

```javascript
// HotUpdateInstaller.js
async function extractHotUpdate(zipPath, version) {
  const platform = Platform.OS;
  const pendingPath = `${getHotUpdateDirectory()}/hotupdate-cache/pending/${version}`;
  
  // 1. Tạo thư mục pending
  await RNFS.mkdir(pendingPath);
  
  // 2. Giải nén ZIP file
  await unzip(zipPath, pendingPath);
  
  // 3. Verify structure
  const expectedFiles = [
    `${pendingPath}/bundles/index.${platform}.bundle`,
    `${pendingPath}/manifest.json`,
    `${pendingPath}/assets/`
  ];
  
  for (const file of expectedFiles) {
    if (!(await RNFS.exists(file))) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
  
  return pendingPath;
}
```

### **Step 2: Verify bundle integrity**

```javascript
async function verifyBundle(bundlePath, manifestPath) {
  try {
    // 1. Kiểm tra file bundle
    const bundleStats = await RNFS.stat(bundlePath);
    if (bundleStats.size === 0) {
      return false;
    }
    
    // 2. Đọc và verify manifest
    const manifest = JSON.parse(await RNFS.readFile(manifestPath, 'utf8'));
    
    // 3. Kiểm tra bundle hash (optional)
    const actualHash = await calculateFileHash(bundlePath);
    if (manifest.bundleHash && actualHash !== manifest.bundleHash) {
      console.warn('Bundle hash mismatch');
      // Có thể accept hoặc reject tùy policy
    }
    
    // 4. Kiểm tra compatibility
    const currentAppVersion = DeviceInfo.getVersion();
    if (manifest.minAppVersion && 
        semver.gt(manifest.minAppVersion, currentAppVersion)) {
      throw new Error(`Hot update requires app version ${manifest.minAppVersion}, current: ${currentAppVersion}`);
    }
    
    return true;
  } catch (error) {
    console.error('Bundle verification failed:', error);
    return false;
  }
}
```

### **Step 3: Activate bundle**

```javascript
async function activateHotUpdate(pendingPath, version) {
  const platform = Platform.OS;
  const activePath = `${getHotUpdateDirectory()}/hotupdate/${platform}/${version}`;
  
  try {
    // 1. Backup current active version (if exists)
    await backupCurrentVersion();
    
    // 2. Move pending to active location
    if (await RNFS.exists(activePath)) {
      await RNFS.unlink(activePath);
    }
    await RNFS.moveFile(pendingPath, activePath);
    
    // 3. Update current version marker
    await RNFS.writeFile(
      `${getHotUpdateDirectory()}/hotupdate/${platform}/current-version.txt`,
      version,
      'utf8'
    );
    
    // 4. Update app state
    setCurrentHotUpdateVersion(version);
    
    console.log(`✅ Hot update v${version} activated`);
    return true;
  } catch (error) {
    console.error('Failed to activate hot update:', error);
    await rollbackToBackup();
    return false;
  }
}
```

## 🚀 Bundle Loading Implementation

### **Bundle Loader Service:**

```javascript
// BundleLoader.js
class BundleLoader {
  static async loadBundle() {
    try {
      // 1. Determine bundle source
      const bundleSource = await this.getBundleSource();
      
      // 2. Setup asset resolver
      await this.setupAssetResolver(bundleSource);
      
      // 3. Load bundle based on platform
      if (Platform.OS === 'ios') {
        await this.loadIOSBundle(bundleSource.bundlePath);
      } else {
        await this.loadAndroidBundle(bundleSource.bundlePath);
      }
      
      return bundleSource;
    } catch (error) {
      console.error('Bundle loading failed:', error);
      // Fallback to main bundle
      return this.loadMainBundle();
    }
  }
  
  static async getBundleSource() {
    // 1. Check for hot update bundle
    const hotUpdateBundle = await this.getLatestHotUpdate();
    if (hotUpdateBundle) {
      return {
        type: 'hotupdate',
        version: hotUpdateBundle.version,
        bundlePath: hotUpdateBundle.bundlePath,
        assetPath: hotUpdateBundle.assetPath
      };
    }
    
    // 2. Use main bundle
    return {
      type: 'main',
      version: DeviceInfo.getVersion(),
      bundlePath: this.getMainBundlePath(),
      assetPath: null
    };
  }
  
  static async getLatestHotUpdate() {
    const platform = Platform.OS;
    const hotUpdateDir = `${getHotUpdateDirectory()}/hotupdate/${platform}`;
    
    try {
      const versions = await RNFS.readDir(hotUpdateDir);
      const validVersions = [];
      
      for (const versionDir of versions) {
        if (!versionDir.isDirectory()) continue;
        
        const bundlePath = `${versionDir.path}/bundles/index.${platform}.bundle`;
        const manifestPath = `${versionDir.path}/manifest.json`;
        const assetPath = `${versionDir.path}/assets`;
        
        if (await this.verifyHotUpdateBundle(bundlePath, manifestPath)) {
          validVersions.push({
            version: versionDir.name,
            bundlePath,
            assetPath,
            manifestPath
          });
        }
      }
      
      if (validVersions.length === 0) return null;
      
      // Sort by semver and return latest
      validVersions.sort((a, b) => semver.compare(b.version, a.version));
      return validVersions[0];
    } catch (error) {
      return null;
    }
  }
}
```

## 🎨 Asset Resolution

### **Asset Resolver Implementation:**

```javascript
// AssetResolver.js
class AssetResolver {
  static hotUpdateAssetPath = null;
  static assetCache = new Map();
  
  static setHotUpdateAssetPath(path) {
    this.hotUpdateAssetPath = path;
    this.assetCache.clear(); // Clear cache when path changes
  }
  
  static async resolveAsset(assetPath) {
    // Cache lookup
    if (this.assetCache.has(assetPath)) {
      return this.assetCache.get(assetPath);
    }
    
    let resolvedPath;
    
    // Try hot update assets first
    if (this.hotUpdateAssetPath) {
      resolvedPath = await this.resolveHotUpdateAsset(assetPath);
      if (resolvedPath) {
        this.assetCache.set(assetPath, resolvedPath);
        return resolvedPath;
      }
    }
    
    // Fallback to main bundle
    resolvedPath = this.resolveMainBundleAsset(assetPath);
    this.assetCache.set(assetPath, resolvedPath);
    return resolvedPath;
  }
  
  static async resolveHotUpdateAsset(assetPath) {
    const platform = Platform.OS;
    
    // Transform asset path như Metro bundler
    const transformedName = this.transformAssetName(assetPath);
    
    if (platform === 'android') {
      // Android density folders
      const densities = ['drawable-xxxhdpi', 'drawable-xxhdpi', 'drawable-xhdpi', 'drawable-hdpi', 'drawable-mdpi'];
      
      for (const density of densities) {
        const fullPath = `${this.hotUpdateAssetPath}/${density}/${transformedName}`;
        if (await RNFS.exists(fullPath)) {
          return `file://${fullPath}`;
        }
      }
    } else {
      // iOS flat structure
      const fullPath = `${this.hotUpdateAssetPath}/${transformedName}`;
      if (await RNFS.exists(fullPath)) {
        return `file://${fullPath}`;
      }
    }
    
    return null;
  }
  
  static transformAssetName(assetPath) {
    // Convert: src/assets/images/1.png -> src_assets_images_1.png
    return assetPath
      .replace(/^\.\//, '')
      .replace(/\//g, '_')
      .replace(/\\/g, '_');
  }
}
```

## 📲 Integration vào React Native App

### **1. App Entry Point (index.js):**

```javascript
// index.js
import { AppRegistry, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { BundleLoader } from './src/services/BundleLoader';

const startApp = async () => {
  try {
    // Initialize hot update system
    await BundleLoader.loadBundle();
    
    // Register app với hot update support
    AppRegistry.registerComponent(appName, () => App);
  } catch (error) {
    console.error('Hot update failed, using main bundle:', error);
    // Fallback registration
    AppRegistry.registerComponent(appName, () => App);
  }
};

startApp();
```

### **2. Asset Loading Override:**

```javascript
// HotUpdateImage.js
import React from 'react';
import { Image } from 'react-native';
import { AssetResolver } from '../services/AssetResolver';

export class HotUpdateImage extends React.Component {
  state = { resolvedSource: null };
  
  async componentDidMount() {
    await this.resolveImageSource();
  }
  
  async componentDidUpdate(prevProps) {
    if (prevProps.source !== this.props.source) {
      await this.resolveImageSource();
    }
  }
  
  async resolveImageSource() {
    const { source } = this.props;
    
    if (typeof source === 'number') {
      // Static require() - try to resolve through hot update
      const assetName = this.getAssetNameFromRequire(source);
      if (assetName) {
        const resolved = await AssetResolver.resolveAsset(assetName);
        this.setState({ resolvedSource: { uri: resolved } });
      } else {
        this.setState({ resolvedSource: source });
      }
    } else {
      // URI source - use as is
      this.setState({ resolvedSource: source });
    }
  }
  
  getAssetNameFromRequire(requireId) {
    // This would need to be implemented based on your asset mapping
    // Could use a generated asset registry from Metro
    return null;
  }
  
  render() {
    const { resolvedSource } = this.state;
    if (!resolvedSource) return null;
    
    return <Image {...this.props} source={resolvedSource} />;
  }
}
```

## 🔄 Update Flow

### **Complete Update Process:**

```
1. App Start
   ↓
2. BundleLoader.loadBundle()
   ↓
3. Check hot update directory
   ↓
4a. Hot update found → Load hot bundle  4b. No hot update → Load main bundle
   ↓                                       ↓
5. Setup AssetResolver with hot path  5. Use main bundle assets
   ↓                                       ↓
6. App runs with hot update ←---------------
   ↓
7. Background: Check for new updates
   ↓
8. Download and install to pending
   ↓
9. Verify and activate
   ↓
10. Restart app or apply on next launch
```

## ⚠️ Key Points

### **Bundle Path Priority:**
1. **Hot Update Bundle**: `Documents/hotupdate/{platform}/{version}/bundles/`
2. **Main Bundle**: App's main bundle location

### **Asset Resolution Priority:**
1. **Hot Update Assets**: `Documents/hotupdate/{platform}/{version}/assets/`
2. **Main Bundle Assets**: App's bundled assets

### **Version Management:**
- Sử dụng semantic versioning
- Kiểm tra `minAppVersion` compatibility
- Backup và rollback mechanism

### **Platform Differences:**
- **Android**: Sử dụng density folders (`drawable-*`)
- **iOS**: Flat asset structure với @2x, @3x suffixes

Với cấu trúc này, hot update sẽ hoạt động seamlessly với React Native app! 🚀