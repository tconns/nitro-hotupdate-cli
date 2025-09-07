import fs from "fs-extra";
import path from "path";
import archiver from "archiver";
import { BundleBuilder, BundleConfig, AssetFile } from "./bundle-builder";
import { BuildConfig } from "./prompt-helper";

export interface BuildResult {
  success: boolean;
  platform: "ios" | "android";
  bundlePath: string;
  assetsPath?: string;
  zipPath: string;
  size: number;
  error?: string;
}

export class HotUpdateBuilder {
  private config: BuildConfig;
  private bundleBuilder: BundleBuilder;

  constructor(config: BuildConfig) {
    this.config = config;
    this.bundleBuilder = new BundleBuilder(config.projectPath);
  }

  /**
   * Build bundles for all specified platforms
   */
  async buildAllPlatforms(): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    console.log("🏗️  Starting hot update build process...\n");

    // Ensure output directory exists
    await fs.ensureDir(this.config.outputPath);

    for (const platform of this.config.platforms) {
      console.log(`📱 Building for ${platform}...`);

      try {
        const result = await this.buildPlatform(platform);
        results.push(result);

        if (result.success) {
          console.log(`✅ ${platform} build completed: ${result.zipPath}`);
          console.log(`   Size: ${this.formatBytes(result.size)}\n`);
        } else {
          console.error(`❌ ${platform} build failed: ${result.error}\n`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          success: false,
          platform,
          bundlePath: "",
          zipPath: "",
          size: 0,
          error: errorMessage,
        });
        console.error(`❌ ${platform} build failed: ${errorMessage}\n`);
      }
    }

    return results;
  }

  /**
   * Build bundle for specific platform
   */
  private async buildPlatform(
    platform: "ios" | "android"
  ): Promise<BuildResult> {
    const platformDir = path.join(this.config.outputPath, platform);
    const bundleDir = path.join(platformDir, "bundles");
    const assetsDir = path.join(platformDir, "assets");

    // Prepare directories
    await fs.ensureDir(bundleDir);
    await fs.ensureDir(assetsDir);

    const bundleName = this.config.bundleName || "index";
    const bundlePath = path.join(bundleDir, `${bundleName}.${platform}.bundle`);
    const sourcemapPath = this.config.sourcemap
      ? path.join(bundleDir, `${bundleName}.${platform}.map`)
      : undefined;

    // Configure bundle build
    const bundleConfig: BundleConfig = {
      entryFile: this.findEntryFile(),
      bundlePath,
      assetsDest: assetsDir,
      sourcemapOutput: sourcemapPath,
      platform,
      dev: false,
      minify: this.config.minify || true,
      resetCache: false,
    };

    try {
      // Build the bundle
      await this.bundleBuilder.buildBundle(bundleConfig);

      // Validate bundle
      const isValid = await this.bundleBuilder.validateBundle(bundlePath);
      if (!isValid) {
        throw new Error("Bundle validation failed");
      }

      // Copy additional assets (non-Metro assets)
      const additionalAssets = await this.copyAdditionalAssets(assetsDir);

      // Analyze Metro-generated assets
      const metroAssets = await this.analyzeMetroAssets(assetsDir);

      // Combine both asset lists
      const allAssets = [...metroAssets, ...additionalAssets];

      // Verify asset consistency
      const verification = await this.verifyAssetConsistency(
        bundlePath,
        assetsDir
      );
      if (verification.warnings.length > 0) {
        console.log("⚠️  Asset warnings:");
        verification.warnings.forEach((warning) =>
          console.log(`   ${warning}`)
        );
      }

      // Generate manifest
      await this.generateHotUpdateManifest(
        platform,
        bundlePath,
        allAssets,
        platformDir
      );

      // Create ZIP file
      const zipPath = await this.createZipFile(platform, platformDir);
      const zipStats = await fs.stat(zipPath);

      return {
        success: true,
        platform,
        bundlePath,
        assetsPath: assetsDir,
        zipPath,
        size: zipStats.size,
      };
    } catch (error) {
      return {
        success: false,
        platform,
        bundlePath,
        zipPath: "",
        size: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Find entry file for React Native project
   */
  private findEntryFile(): string {
    const possibleEntries = ["index.js", "index.ts", "index.jsx", "index.tsx"];

    for (const entry of possibleEntries) {
      const entryPath = path.join(this.config.projectPath, entry);
      if (fs.existsSync(entryPath)) {
        return entry;
      }
    }

    // Default to index.js
    return "index.js";
  }

  /**
   * Analyze Metro-generated assets and create asset mapping
   */
  private async analyzeMetroAssets(assetsDir: string): Promise<AssetFile[]> {
    const assetFiles: AssetFile[] = [];

    // Metro creates platform-specific asset directories
    const assetDirs = [
      "drawable-mdpi",
      "drawable-hdpi",
      "drawable-xhdpi",
      "drawable-xxhdpi",
      "drawable-xxxhdpi",
      "raw",
    ];

    for (const dir of assetDirs) {
      const dirPath = path.join(assetsDir, dir);
      if (await fs.pathExists(dirPath)) {
        const files = await fs.readdir(dirPath);

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);

          if (stats.isFile()) {
            const assetFile: AssetFile = {
              name: file,
              type: path.extname(file).substring(1),
              httpServerLocation: `${dir}/${file}`, // Metro asset path
              scales: this.getDensityScale(dir),
              hash: stats.mtime.getTime().toString(),
            };

            assetFiles.push(assetFile);
          }
        }
      }
    }

    return assetFiles;
  }

  /**
   * Get density scale from drawable directory name
   */
  private getDensityScale(dirName: string): number[] {
    const scaleMap: Record<string, number[]> = {
      "drawable-mdpi": [1],
      "drawable-hdpi": [1.5],
      "drawable-xhdpi": [2],
      "drawable-xxhdpi": [3],
      "drawable-xxxhdpi": [4],
      raw: [1],
    };

    return scaleMap[dirName] || [1];
  }
  private async copyAdditionalAssets(assetsDir: string): Promise<AssetFile[]> {
    // Metro already handles most assets when bundling
    // We only need to copy additional assets that are referenced outside of require()
    const assetPatterns = [
      "assets/**/*", // Root assets folder (if any)
      // Don't copy src/assets as they're already bundled by Metro
    ];

    const excludePatterns = [
      "node_modules/**",
      "ios/**",
      "android/**",
      ".git/**",
      "dist/**",
      "build/**",
      "src/**", // Exclude src assets as Metro handles them
      "**/.DS_Store",
      "**/*.md",
      "**/*.txt",
    ];

    return this.bundleBuilder.copyAssets(
      assetPatterns,
      assetsDir,
      excludePatterns
    );
  }

  /**
   * Generate hot update manifest
   */
  private async generateHotUpdateManifest(
    platform: string,
    bundlePath: string,
    assets: AssetFile[],
    outputDir: string
  ): Promise<void> {
    const bundleInfo = await this.bundleBuilder.getBundleInfo(bundlePath);

    const manifest = {
      version: this.config.version,
      platform,
      bundleUrl: `bundles/${path.basename(bundlePath)}`,
      bundleSize: bundleInfo.size,
      bundleHash: bundleInfo.hash,
      assets: assets.map((asset) => ({
        name: asset.name,
        type: asset.type,
        url: asset.httpServerLocation,
        hash: asset.hash,
        size: 0, // Will be filled by actual file size if needed
      })),
      timestamp: Date.now(),
      minAppVersion: "1.0.0", // Can be configured later
      metadata: {
        buildTime: new Date().toISOString(),
        builder: "nitro-hotupdate-cli",
        sourcemap: !!this.config.sourcemap,
        minified: !!this.config.minify,
      },
    };

    const manifestPath = path.join(outputDir, "manifest.json");
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });

    console.log(`📄 Generated hot update manifest: ${manifestPath}`);
  }

  /**
   * Verify that bundle assets are consistent with hot update package
   */
  private async verifyAssetConsistency(
    bundlePath: string,
    assetsDir: string
  ): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    // Read bundle content to find asset references
    const bundleContent = await fs.readFile(bundlePath, "utf8");

    // Look for common asset require patterns
    const assetPatterns = [
      /require\(['"]([^'"]+\.(?:png|jpg|jpeg|gif|webp|svg))['"]]/g,
      /import\s+[^'"]+\s+from\s+['"]([^'"]+\.(?:png|jpg|jpeg|gif|webp|svg))['"]]/g,
    ];

    const bundleAssets = new Set<string>();

    for (const pattern of assetPatterns) {
      let match;
      while ((match = pattern.exec(bundleContent)) !== null) {
        bundleAssets.add(match[1]);
      }
    }

    console.log(`🔍 Found ${bundleAssets.size} asset references in bundle`);

    // Check if Metro generated corresponding assets
    const metroAssets = await this.analyzeMetroAssets(assetsDir);
    const metroAssetNames = new Set(metroAssets.map((a) => a.name));

    // Verify assets exist
    for (const assetPath of bundleAssets) {
      const assetName = path.basename(assetPath);
      const assetNameWithoutExt = path.parse(assetName).name;

      // Metro generates assets with hash suffixes sometimes
      const hasMetroAsset = Array.from(metroAssetNames).some((name) =>
        name.includes(assetNameWithoutExt)
      );

      if (!hasMetroAsset) {
        warnings.push(
          `Asset referenced in bundle but not found in Metro output: ${assetPath}`
        );
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }
  private async createZipFile(
    platform: string,
    platformDir: string
  ): Promise<string> {
    const zipPath = path.join(
      this.config.outputPath,
      `${platform}-v${this.config.version}-hotupdate.zip`
    );

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        console.log(`📦 Created ZIP: ${zipPath} (${archive.pointer()} bytes)`);
        resolve(zipPath);
      });

      archive.on("error", (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add all files from platform directory to ZIP
      archive.directory(platformDir, false);
      archive.finalize();
    });
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Get build summary
   */
  static getSummary(results: BuildResult[]): void {
    console.log("\n📊 Build Summary:");
    console.log("==================");

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`✅ Successful builds: ${successful.length}`);
    console.log(`❌ Failed builds: ${failed.length}`);

    if (successful.length > 0) {
      console.log("\nSuccessful builds:");
      successful.forEach((result) => {
        console.log(`  📱 ${result.platform}: ${result.zipPath}`);
        console.log(`     Size: ${this.prototype.formatBytes(result.size)}`);
      });
    }

    if (failed.length > 0) {
      console.log("\nFailed builds:");
      failed.forEach((result) => {
        console.log(`  ❌ ${result.platform}: ${result.error}`);
      });
    }

    console.log("");
  }
}
