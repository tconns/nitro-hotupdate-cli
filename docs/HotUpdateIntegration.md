# Hot Update Integration Guide

## 🎯 Kiến trúc Hot Update System

### 📁 Cấu trúc thư mục trong app:

```
ReactNativeApp/
├── index.js (entry point)
├── bundle/ (hot update bundles)
│   ├── main.jsbundle (iOS bundle chính)
│   ├── index.android.bundle (Android bundle chính)
│   └── hotupdate/
│       ├── ios/
│       │   ├── v1.0.1/
│       │   │   ├── bundles/index.ios.bundle
│       │   │   ├── assets/ (drawable-* folders)
│       │   │   └── manifest.json
│       │   └── v1.0.2/
│       └── android/
│           ├── v1.0.1/
│           │   ├── bundles/index.android.bundle
│           │   ├── assets/ (drawable-* folders)
│           │   └── manifest.json
│           └── v1.0.2/
├── assets/ (fallback assets từ main bundle)
└── Documents/ (iOS) | Internal Storage (Android)
    └── hotupdate-cache/
        ├── pending/ (bundles đang download)
        ├── active/ (bundle hiện tại)
        └── backup/ (bundle backup)
```

## 🔧 Implementation Strategy

### 1. **Bundle Loading Priority**

```typescript
// HotUpdateManager.ts
class HotUpdateManager {
  private bundlePath: string = '';
  private assetPath: string = '';

  async getBundlePath(): Promise<string> {
    // 1. Kiểm tra hot update bundle mới nhất
    const hotUpdateBundle = await this.getLatestHotUpdateBundle();
    if (hotUpdateBundle) {
      return hotUpdateBundle;
    }

    // 2. Fallback về main bundle
    return this.getMainBundlePath();
  }

  private async getLatestHotUpdateBundle(): Promise<string | null> {
    const platform = Platform.OS;
    const hotUpdateDir = `${DocumentDirectoryPath}/hotupdate/${platform}`;
    
    try {
      // Đọc danh sách versions
      const versions = await RNFS.readDir(hotUpdateDir);
      const sortedVersions = versions
        .filter(v => v.isDirectory())
        .sort((a, b) => semver.compare(b.name, a.name)); // Newest first

      for (const version of sortedVersions) {
        const bundlePath = `${version.path}/bundles/index.${platform}.bundle`;
        const manifestPath = `${version.path}/manifest.json`;
        
        // Verify bundle integrity
        if (await this.verifyBundle(bundlePath, manifestPath)) {
          return bundlePath;
        }
      }
    } catch (error) {
      console.log('No hot update bundle found, using main bundle');
    }

    return null;
  }
}
```

### 2. **Asset Path Resolution**

```typescript
// AssetResolver.ts
class AssetResolver {
  private hotUpdateAssetPath: string = '';

  async resolveAssetPath(assetName: string): Promise<string> {
    const platform = Platform.OS;
    
    // 1. Tìm trong hot update assets
    const hotUpdateAsset = await this.findInHotUpdateAssets(assetName);
    if (hotUpdateAsset) {
      return hotUpdateAsset;
    }

    // 2. Fallback về main bundle assets
    return this.getMainBundleAssetPath(assetName);
  }

  private async findInHotUpdateAssets(assetName: string): Promise<string | null> {
    const currentVersion = await this.getCurrentHotUpdateVersion();
    if (!currentVersion) return null;

    const platform = Platform.OS;
    const basePath = `${DocumentDirectoryPath}/hotupdate/${platform}/${currentVersion}`;
    
    // Metro tạo assets với density folders cho Android
    if (platform === 'android') {
      const densityFolders = ['drawable-xxxhdpi', 'drawable-xxhdpi', 'drawable-xhdpi', 'drawable-mdpi'];
      
      for (const density of densityFolders) {
        const assetPath = `${basePath}/assets/${density}/${assetName}`;
        if (await RNFS.exists(assetPath)) {
          return `file://${assetPath}`;
        }
      }
    } else {
      // iOS assets
      const assetPath = `${basePath}/assets/${assetName}`;
      if (await RNFS.exists(assetPath)) {
        return `file://${assetPath}`;
      }
    }

    return null;
  }
}
```

### 3. **Hot Update Download & Installation**

```typescript
// HotUpdateInstaller.ts
class HotUpdateInstaller {
  async downloadAndInstall(updateInfo: HotUpdateInfo): Promise<boolean> {
    try {
      // 1. Download ZIP file
      const zipPath = await this.downloadHotUpdate(updateInfo.downloadUrl);
      
      // 2. Verify integrity
      if (!await this.verifyDownload(zipPath, updateInfo.hash)) {
        throw new Error('Download verification failed');
      }

      // 3. Extract to pending directory
      const pendingPath = await this.extractToPending(zipPath, updateInfo.version);
      
      // 4. Verify extracted bundle
      if (!await this.verifyExtractedBundle(pendingPath)) {
        throw new Error('Bundle verification failed');
      }

      // 5. Backup current bundle (if exists)
      await this.backupCurrentBundle();

      // 6. Move pending to active
      await this.activateBundle(pendingPath, updateInfo.version);

      // 7. Cleanup
      await this.cleanup(zipPath, pendingPath);

      return true;
    } catch (error) {
      console.error('Hot update installation failed:', error);
      await this.rollback();
      return false;
    }
  }

  private async extractToPending(zipPath: string, version: string): Promise<string> {
    const platform = Platform.OS;
    const pendingPath = `${DocumentDirectoryPath}/hotupdate-cache/pending/${version}`;
    
    // Đảm bảo thư mục tồn tại
    await RNFS.mkdir(pendingPath);

    // Extract ZIP với đúng structure
    await unzip(zipPath, pendingPath);

    return pendingPath;
  }

  private async activateBundle(pendingPath: string, version: string): Promise<void> {
    const platform = Platform.OS;
    const activePath = `${DocumentDirectoryPath}/hotupdate/${platform}/${version}`;
    
    // Di chuyển từ pending sang active location
    await RNFS.moveFile(pendingPath, activePath);
    
    // Update current version tracking
    await this.updateCurrentVersion(version);
  }
}
```

## 🚀 App Integration Points

### 1. **Entry Point Modification**

```typescript
// index.js (App Entry Point)
import { AppRegistry, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { HotUpdateManager } from './src/services/HotUpdateManager';

const startApp = async () => {
  try {
    // Kiểm tra và load hot update bundle nếu có
    const hotUpdateManager = new HotUpdateManager();
    await hotUpdateManager.initializeHotUpdate();
    
    // Register app như bình thường
    AppRegistry.registerComponent(appName, () => App);
  } catch (error) {
    console.error('Hot update initialization failed:', error);
    // Fallback to main bundle
    AppRegistry.registerComponent(appName, () => App);
  }
};

startApp();
```

### 2. **Asset Loading Override**

```typescript
// ImageLoader.ts
import { Image, Platform } from 'react-native';
import { AssetResolver } from './AssetResolver';

class HotUpdateImage extends Component {
  state = { resolvedSource: null };
  
  async componentDidMount() {
    const { source } = this.props;
    
    if (typeof source === 'number') {
      // Static require() - use as is
      this.setState({ resolvedSource: source });
    } else if (source.uri && source.uri.startsWith('asset://')) {
      // Asset URI - resolve through hot update
      const assetResolver = new AssetResolver();
      const resolvedUri = await assetResolver.resolveAssetPath(source.uri);
      this.setState({ resolvedSource: { uri: resolvedUri } });
    } else {
      // Network or file URI - use as is
      this.setState({ resolvedSource: source });
    }
  }
  
  render() {
    const { resolvedSource } = this.state;
    if (!resolvedSource) return null;
    
    return <Image {...this.props} source={resolvedSource} />;
  }
}
```

### 3. **Bundle Loading với CodePush-like API**

```typescript
// HotUpdateProvider.tsx
export const HotUpdateProvider = ({ children }) => {
  const [bundleLoaded, setBundleLoaded] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    initializeHotUpdate();
  }, []);

  const initializeHotUpdate = async () => {
    try {
      // 1. Load current bundle
      const hotUpdateManager = new HotUpdateManager();
      await hotUpdateManager.loadBundle();
      setBundleLoaded(true);

      // 2. Check for updates in background
      checkForUpdates();
    } catch (error) {
      console.error('Hot update failed:', error);
      setBundleLoaded(true); // Continue with main bundle
    }
  };

  const checkForUpdates = async () => {
    try {
      const updateChecker = new HotUpdateChecker();
      const update = await updateChecker.checkForUpdate();
      
      if (update) {
        setUpdateAvailable(true);
        // Auto-download in background
        await downloadUpdate(update);
      }
    } catch (error) {
      console.log('Update check failed:', error);
    }
  };

  if (!bundleLoaded) {
    return <LoadingScreen />;
  }

  return (
    <HotUpdateContext.Provider value={{ updateAvailable, applyUpdate }}>
      {children}
    </HotUpdateContext.Provider>
  );
};
```

## 📱 Platform-Specific Implementation

### **Android Implementation:**

```kotlin
// HotUpdateManager.kt (Native Module)
class HotUpdateManager : ReactContextBaseJavaModule(reactContext) {
  
  fun loadBundleFromPath(bundlePath: String, promise: Promise) {
    try {
      val bundle = ReactNativeHost.createBundleFromPath(bundlePath)
      val reactContext = reactApplicationContext
      
      // Reload React context với bundle mới
      reactContext.catalystInstance.loadBundle(bundle)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BUNDLE_LOAD_ERROR", e.message)
    }
  }
  
  fun updateAssetPath(assetPath: String) {
    // Update asset resolver để point đến hot update assets
    AssetManager.setHotUpdateAssetPath(assetPath)
  }
}
```

### **iOS Implementation:**

```objective-c
// HotUpdateManager.m (Native Module)
@implementation HotUpdateManager

RCT_EXPORT_METHOD(loadBundleFromPath:(NSString *)bundlePath 
                 resolver:(RCTPromiseResolveBlock)resolve 
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *bundleURL = [NSURL fileURLWithPath:bundlePath];
  
  dispatch_async(dispatch_get_main_queue(), ^{
    RCTBridge *bridge = [RCTBridge alloc];
    [bridge initWithBundleURL:bundleURL 
              moduleProvider:nil 
               launchOptions:nil];
    
    if (bridge) {
      resolve(@YES);
    } else {
      reject(@"BUNDLE_LOAD_ERROR", @"Failed to load bundle", nil);
    }
  });
}

@end
```

## 🔄 Update Flow Diagram

```
1. App Start
   ↓
2. Check Hot Update Bundle
   ↓
3a. Found → Load Hot Update    3b. Not Found → Load Main Bundle
   ↓                             ↓
4. App Running ←------------------
   ↓
5. Background Update Check
   ↓
6a. Update Available → Download  6b. No Update → Continue
   ↓
7. Extract & Verify
   ↓
8. Install to Pending
   ↓
9. User Restart / Apply Now
   ↓
10. Activate New Bundle
```

## ⚠️ Important Considerations

### **Asset Path Resolution:**
- Metro transforms asset names: `src/assets/images/1.png` → `src_assets_images_1.png`
- Android sử dụng density folders: `drawable-mdpi`, `drawable-xhdpi`, etc.
- iOS bundle assets flat structure trong main bundle

### **Bundle Compatibility:**
- Hot update bundle phải compatible với native code version
- Manifest phải chứa `minAppVersion` để verify compatibility
- Rollback mechanism nếu bundle crash

### **Performance:**
- Lazy load assets khi cần thiết
- Cache resolved asset paths
- Background download để không block UI

### **Security:**
- Verify bundle signature trước khi install
- Encrypted download channels
- Validate bundle integrity với hash checking

Với cấu trúc này, hot update system sẽ hoạt động seamlessly với React Native app! 🚀