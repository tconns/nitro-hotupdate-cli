/**
 * Hot Update Integration Examples
 * Các ví dụ implementation cụ thể cho hot update system
 */

// 1. HotUpdateManager - Core service
export class HotUpdateManager {
  private static instance: HotUpdateManager;
  private currentVersion: string = '';
  private bundlePath: string = '';
  private assetPath: string = '';

  static getInstance(): HotUpdateManager {
    if (!HotUpdateManager.instance) {
      HotUpdateManager.instance = new HotUpdateManager();
    }
    return HotUpdateManager.instance;
  }

  /**
   * Initialize hot update system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Hot Update System...');
      
      // 1. Setup directories
      await this.setupDirectories();
      
      // 2. Load current bundle
      const bundlePath = await this.getBundlePath();
      
      // 3. Setup asset resolver
      await this.setupAssetResolver();
      
      console.log(`✅ Hot Update initialized with bundle: ${bundlePath}`);
    } catch (error) {
      console.error('❌ Hot Update initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get bundle path with priority: hot update > main bundle
   */
  async getBundlePath(): Promise<string> {
    // 1. Check for hot update bundle
    const hotUpdateBundle = await this.getLatestHotUpdateBundle();
    if (hotUpdateBundle) {
      this.bundlePath = hotUpdateBundle;
      return hotUpdateBundle;
    }

    // 2. Fallback to main bundle
    const mainBundle = this.getMainBundlePath();
    this.bundlePath = mainBundle;
    return mainBundle;
  }

  /**
   * Find latest hot update bundle
   */
  private async getLatestHotUpdateBundle(): Promise<string | null> {
    const platform = Platform.OS;
    const hotUpdateDir = `${RNFS.DocumentDirectoryPath}/hotupdate/${platform}`;

    try {
      // Check if hot update directory exists
      const exists = await RNFS.exists(hotUpdateDir);
      if (!exists) {
        return null;
      }

      // Read available versions
      const versions = await RNFS.readDir(hotUpdateDir);
      const validVersions = [];

      for (const versionDir of versions) {
        if (!versionDir.isDirectory()) continue;

        const bundlePath = `${versionDir.path}/bundles/index.${platform}.bundle`;
        const manifestPath = `${versionDir.path}/manifest.json`;

        // Verify bundle integrity
        if (await this.verifyBundle(bundlePath, manifestPath)) {
          validVersions.push({
            version: versionDir.name,
            path: bundlePath,
            manifestPath
          });
        }
      }

      if (validVersions.length === 0) {
        return null;
      }

      // Sort by version (semver) and get latest
      validVersions.sort((a, b) => semver.compare(b.version, a.version));
      const latest = validVersions[0];

      console.log(`📦 Found hot update bundle: v${latest.version}`);
      this.currentVersion = latest.version;
      
      return latest.path;
    } catch (error) {
      console.log('No valid hot update bundle found:', error.message);
      return null;
    }
  }

  /**
   * Verify bundle integrity
   */
  private async verifyBundle(bundlePath: string, manifestPath: string): Promise<boolean> {
    try {
      // 1. Check if bundle file exists
      const bundleExists = await RNFS.exists(bundlePath);
      if (!bundleExists) {
        return false;
      }

      // 2. Check bundle size
      const bundleStats = await RNFS.stat(bundlePath);
      if (bundleStats.size === 0) {
        return false;
      }

      // 3. Check manifest
      const manifestExists = await RNFS.exists(manifestPath);
      if (!manifestExists) {
        return false;
      }

      // 4. Verify manifest content
      const manifestContent = await RNFS.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // Check manifest structure
      if (!manifest.version || !manifest.bundleUrl || !manifest.bundleHash) {
        return false;
      }

      // 5. Verify bundle hash (optional but recommended)
      // const bundleHash = await this.calculateBundleHash(bundlePath);
      // return bundleHash === manifest.bundleHash;

      return true;
    } catch (error) {
      console.error('Bundle verification failed:', error);
      return false;
    }
  }

  /**
   * Setup asset resolver for hot update assets
   */
  private async setupAssetResolver(): Promise<void> {
    if (!this.currentVersion) {
      return; // Using main bundle assets
    }

    const platform = Platform.OS;
    const assetPath = `${RNFS.DocumentDirectoryPath}/hotupdate/${platform}/${this.currentVersion}/assets`;
    
    const exists = await RNFS.exists(assetPath);
    if (exists) {
      this.assetPath = assetPath;
      console.log(`📁 Hot update assets path: ${assetPath}`);
    }
  }

  /**
   * Get main bundle path
   */
  private getMainBundlePath(): string {
    if (Platform.OS === 'ios') {
      return `${RNFS.MainBundlePath}/main.jsbundle`;
    } else {
      return 'index.android.bundle'; // Asset bundle path for Android
    }
  }

  /**
   * Setup required directories
   */
  private async setupDirectories(): Promise<void> {
    const baseDir = `${RNFS.DocumentDirectoryPath}/hotupdate`;
    const cacheDir = `${RNFS.DocumentDirectoryPath}/hotupdate-cache`;
    
    const directories = [
      baseDir,
      `${baseDir}/ios`,
      `${baseDir}/android`,
      cacheDir,
      `${cacheDir}/pending`,
      `${cacheDir}/backup`
    ];

    for (const dir of directories) {
      const exists = await RNFS.exists(dir);
      if (!exists) {
        await RNFS.mkdir(dir);
      }
    }
  }
}

// 2. AssetResolver - Handle asset path resolution
export class AssetResolver {
  private static instance: AssetResolver;
  private hotUpdateAssetPath: string = '';
  private assetCache: Map<string, string> = new Map();

  static getInstance(): AssetResolver {
    if (!AssetResolver.instance) {
      AssetResolver.instance = new AssetResolver();
    }
    return AssetResolver.instance;
  }

  setHotUpdateAssetPath(path: string): void {
    this.hotUpdateAssetPath = path;
    this.assetCache.clear(); // Clear cache when path changes
  }

  /**
   * Resolve asset path with caching
   */
  async resolveAssetPath(assetName: string): Promise<string> {
    // Check cache first
    const cached = this.assetCache.get(assetName);
    if (cached) {
      return cached;
    }

    // Try hot update assets first
    if (this.hotUpdateAssetPath) {
      const hotUpdateAsset = await this.findInHotUpdateAssets(assetName);
      if (hotUpdateAsset) {
        this.assetCache.set(assetName, hotUpdateAsset);
        return hotUpdateAsset;
      }
    }

    // Fallback to main bundle assets
    const mainBundleAsset = this.getMainBundleAssetPath(assetName);
    this.assetCache.set(assetName, mainBundleAsset);
    return mainBundleAsset;
  }

  /**
   * Find asset in hot update directory
   */
  private async findInHotUpdateAssets(assetName: string): Promise<string | null> {
    const platform = Platform.OS;

    try {
      if (platform === 'android') {
        // Android uses density-specific folders
        const densityFolders = [
          'drawable-xxxhdpi',
          'drawable-xxhdpi', 
          'drawable-xhdpi',
          'drawable-hdpi',
          'drawable-mdpi'
        ];

        // Transform asset name như Metro bundler
        const transformedName = this.transformAssetName(assetName);

        for (const density of densityFolders) {
          const assetPath = `${this.hotUpdateAssetPath}/${density}/${transformedName}`;
          const exists = await RNFS.exists(assetPath);
          
          if (exists) {
            return `file://${assetPath}`;
          }
        }
      } else {
        // iOS assets
        const transformedName = this.transformAssetName(assetName);
        const assetPath = `${this.hotUpdateAssetPath}/${transformedName}`;
        
        const exists = await RNFS.exists(assetPath);
        if (exists) {
          return `file://${assetPath}`;
        }
      }
    } catch (error) {
      console.error('Error finding hot update asset:', error);
    }

    return null;
  }

  /**
   * Transform asset name like Metro bundler does
   */
  private transformAssetName(assetName: string): string {
    // Metro transforms: src/assets/images/1.png -> src_assets_images_1.png
    return assetName
      .replace(/^\.\//, '')
      .replace(/\//g, '_')
      .replace(/\\/g, '_');
  }

  /**
   * Get main bundle asset path
   */
  private getMainBundleAssetPath(assetName: string): string {
    if (Platform.OS === 'ios') {
      return `${RNFS.MainBundlePath}/${assetName}`;
    } else {
      return `asset:///${assetName}`;
    }
  }
}

// 3. HotUpdateInstaller - Download and install updates
export class HotUpdateInstaller {
  private downloadProgress: (progress: number) => void = () => {};

  setDownloadProgressCallback(callback: (progress: number) => void): void {
    this.downloadProgress = callback;
  }

  /**
   * Download and install hot update
   */
  async downloadAndInstall(updateInfo: HotUpdateInfo): Promise<boolean> {
    try {
      console.log(`📥 Downloading hot update v${updateInfo.version}...`);

      // 1. Download ZIP file
      const zipPath = await this.downloadUpdate(updateInfo);

      // 2. Verify download integrity
      if (!await this.verifyDownload(zipPath, updateInfo.hash)) {
        throw new Error('Download verification failed');
      }

      // 3. Extract to pending directory
      const pendingPath = await this.extractUpdate(zipPath, updateInfo.version);

      // 4. Verify extracted bundle
      if (!await this.verifyExtractedBundle(pendingPath)) {
        throw new Error('Extracted bundle verification failed');
      }

      // 5. Backup current version
      await this.backupCurrentVersion();

      // 6. Install new version
      await this.installUpdate(pendingPath, updateInfo.version);

      // 7. Cleanup temporary files
      await this.cleanup(zipPath);

      console.log(`✅ Hot update v${updateInfo.version} installed successfully`);
      return true;

    } catch (error) {
      console.error('❌ Hot update installation failed:', error);
      await this.rollback();
      return false;
    }
  }

  /**
   * Download update ZIP file
   */
  private async downloadUpdate(updateInfo: HotUpdateInfo): Promise<string> {
    const platform = Platform.OS;
    const fileName = `${platform}-v${updateInfo.version}-hotupdate.zip`;
    const downloadPath = `${RNFS.DocumentDirectoryPath}/hotupdate-cache/pending/${fileName}`;

    const downloadOptions = {
      fromUrl: updateInfo.downloadUrl,
      toFile: downloadPath,
      progress: (res: any) => {
        const progress = (res.bytesWritten / res.contentLength) * 100;
        this.downloadProgress(progress);
      }
    };

    const result = await RNFS.downloadFile(downloadOptions).promise;
    
    if (result.statusCode !== 200) {
      throw new Error(`Download failed with status: ${result.statusCode}`);
    }

    return downloadPath;
  }

  /**
   * Extract ZIP to pending directory
   */
  private async extractUpdate(zipPath: string, version: string): Promise<string> {
    const platform = Platform.OS;
    const extractPath = `${RNFS.DocumentDirectoryPath}/hotupdate-cache/pending/${version}`;

    // Ensure directory exists
    const exists = await RNFS.exists(extractPath);
    if (exists) {
      await RNFS.unlink(extractPath);
    }
    await RNFS.mkdir(extractPath);

    // Extract ZIP file
    await unzip(zipPath, extractPath);

    return extractPath;
  }

  /**
   * Install update from pending to active location
   */
  private async installUpdate(pendingPath: string, version: string): Promise<void> {
    const platform = Platform.OS;
    const activePath = `${RNFS.DocumentDirectoryPath}/hotupdate/${platform}/${version}`;

    // Remove existing version if present
    const exists = await RNFS.exists(activePath);
    if (exists) {
      await RNFS.unlink(activePath);
    }

    // Move from pending to active
    await RNFS.moveFile(pendingPath, activePath);

    // Update current version marker
    await this.updateCurrentVersionMarker(version);
  }

  /**
   * Update current version marker file
   */
  private async updateCurrentVersionMarker(version: string): Promise<void> {
    const platform = Platform.OS;
    const markerPath = `${RNFS.DocumentDirectoryPath}/hotupdate/${platform}/current-version.txt`;
    await RNFS.writeFile(markerPath, version, 'utf8');
  }
}

// 4. Usage Example trong App Component
export const useHotUpdate = () => {
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'downloading' | 'ready' | 'none'>('none');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const checkForUpdate = async () => {
    setUpdateStatus('checking');
    
    try {
      const updateChecker = new HotUpdateChecker();
      const updateInfo = await updateChecker.checkForUpdate();
      
      if (updateInfo) {
        await downloadUpdate(updateInfo);
      } else {
        setUpdateStatus('none');
      }
    } catch (error) {
      console.error('Update check failed:', error);
      setUpdateStatus('none');
    }
  };

  const downloadUpdate = async (updateInfo: HotUpdateInfo) => {
    setUpdateStatus('downloading');
    
    const installer = new HotUpdateInstaller();
    installer.setDownloadProgressCallback(setDownloadProgress);
    
    const success = await installer.downloadAndInstall(updateInfo);
    
    if (success) {
      setUpdateStatus('ready');
    } else {
      setUpdateStatus('none');
    }
  };

  const applyUpdate = () => {
    // Restart app to apply hot update
    if (Platform.OS === 'android') {
      RNRestart.Restart();
    } else {
      // iOS restart
      RNRestart.Restart();
    }
  };

  return {
    updateStatus,
    downloadProgress,
    checkForUpdate,
    applyUpdate
  };
};

// 5. Types and Interfaces
export interface HotUpdateInfo {
  version: string;
  downloadUrl: string;
  hash: string;
  mandatory: boolean;
  description: string;
  minAppVersion: string;
}

export interface HotUpdateManifest {
  version: string;
  platform: string;
  bundleUrl: string;
  bundleSize: number;
  bundleHash: string;
  assets: Array<{
    name: string;
    type: string;
    url: string;
    hash: string;
  }>;
  timestamp: number;
  minAppVersion: string;
}