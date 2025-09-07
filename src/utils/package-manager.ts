import * as fs from "fs-extra";
import * as path from "path";
import archiver from "archiver";

export interface ZipConfig {
  enabled: boolean;
  outputDir: string;
  separate: boolean;
  naming: {
    template: string;
    includeManifest: boolean;
  };
}

export interface PackageInfo {
  platform: string;
  version: string;
  timestamp: string;
  bundleSize: number;
  assetCount: number;
  zipPath: string;
  manifest: any;
}

export class PackageManager {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async createZipPackage(
    sourceDir: string,
    platform: string,
    version: string,
    config: ZipConfig
  ): Promise<PackageInfo> {
    console.log(`📦 Creating ZIP package for ${platform}...`);

    await fs.ensureDir(config.outputDir);

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const zipName =
      config.naming.template
        .replace("{platform}", platform)
        .replace("{version}", version)
        .replace("{timestamp}", timestamp) + ".zip";

    const zipPath = path.join(config.outputDir, zipName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      let bundleSize = 0;
      let assetCount = 0;
      let manifest: any = null;

      output.on("close", () => {
        console.log(
          `✅ Package created: ${zipPath} (${(
            archive.pointer() /
            1024 /
            1024
          ).toFixed(2)} MB)`
        );

        resolve({
          platform,
          version,
          timestamp,
          bundleSize,
          assetCount,
          zipPath,
          manifest,
        });
      });

      archive.on("warning", (err: any) => {
        if (err.code === "ENOENT") {
          console.warn("⚠️ Warning:", err);
        } else {
          reject(err);
        }
      });

      archive.on("error", (err: any) => {
        reject(err);
      });

      archive.pipe(output);

      // Add all files from source directory
      archive.directory(sourceDir, false);

      // Count assets and get bundle size
      this.countPackageContents(sourceDir).then(
        ({ bundle, assets, manifestData }) => {
          bundleSize = bundle;
          assetCount = assets;
          manifest = manifestData;
        }
      );

      archive.finalize();
    });
  }

  private async countPackageContents(
    sourceDir: string
  ): Promise<{ bundle: number; assets: number; manifestData: any }> {
    let bundleSize = 0;
    let assetCount = 0;
    let manifestData = null;

    const files = await fs.readdir(sourceDir);

    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        if (file.includes(".bundle") || file.includes(".jsbundle")) {
          bundleSize = stats.size;
        } else if (file === "manifest.json") {
          manifestData = await fs.readJSON(filePath);
        } else if (!file.includes(".map")) {
          assetCount++;
        }
      }
    }

    return { bundle: bundleSize, assets: assetCount, manifestData };
  }

  async createSeparatePackages(
    platforms: string[],
    version: string,
    config: ZipConfig,
    baseOutputDir: string
  ): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];

    for (const platform of platforms) {
      const platformDir = path.join(baseOutputDir, platform);

      if (await fs.pathExists(platformDir)) {
        const packageInfo = await this.createZipPackage(
          platformDir,
          platform,
          version,
          config
        );
        packages.push(packageInfo);
      } else {
        console.warn(`⚠️ Platform directory not found: ${platformDir}`);
      }
    }

    return packages;
  }

  async createCombinedPackage(
    platforms: string[],
    version: string,
    config: ZipConfig,
    baseOutputDir: string
  ): Promise<PackageInfo> {
    console.log("📦 Creating combined package for all platforms...");

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const zipName = `combined-${version}-${timestamp}.zip`;
    const zipPath = path.join(config.outputDir, zipName);

    await fs.ensureDir(config.outputDir);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      let totalBundleSize = 0;
      let totalAssetCount = 0;
      const manifests: any = {};

      output.on("close", () => {
        console.log(
          `✅ Combined package created: ${zipPath} (${(
            archive.pointer() /
            1024 /
            1024
          ).toFixed(2)} MB)`
        );

        resolve({
          platform: "combined",
          version,
          timestamp,
          bundleSize: totalBundleSize,
          assetCount: totalAssetCount,
          zipPath,
          manifest: manifests,
        });
      });

      archive.on("error", reject);
      archive.pipe(output);

      // Add each platform as a subdirectory
      const addPlatformPromises = platforms.map(async (platform) => {
        const platformDir = path.join(baseOutputDir, platform);

        if (await fs.pathExists(platformDir)) {
          archive.directory(platformDir, platform);

          const { bundle, assets, manifestData } =
            await this.countPackageContents(platformDir);
          totalBundleSize += bundle;
          totalAssetCount += assets;
          manifests[platform] = manifestData;
        }
      });

      Promise.all(addPlatformPromises)
        .then(() => archive.finalize())
        .catch(reject);
    });
  }

  async generatePackageManifest(
    packages: PackageInfo[],
    outputDir: string
  ): Promise<void> {
    const manifestPath = path.join(outputDir, "packages-manifest.json");

    const packageManifest = {
      generated: new Date().toISOString(),
      packages: packages.map((pkg) => ({
        platform: pkg.platform,
        version: pkg.version,
        timestamp: pkg.timestamp,
        filename: path.basename(pkg.zipPath),
        size: (pkg.bundleSize / 1024 / 1024).toFixed(2) + " MB",
        bundleSize: pkg.bundleSize,
        assetCount: pkg.assetCount,
        checksum: pkg.manifest?.bundleHash || "unknown",
      })),
      totalPackages: packages.length,
      summary: {
        platforms: packages.map((p) => p.platform),
        totalSize: packages.reduce((sum, p) => sum + p.bundleSize, 0),
        totalAssets: packages.reduce((sum, p) => sum + p.assetCount, 0),
      },
    };

    await fs.writeJSON(manifestPath, packageManifest, { spaces: 2 });
    console.log(`📄 Package manifest generated: ${manifestPath}`);
  }

  async validatePackage(zipPath: string): Promise<boolean> {
    try {
      const exists = await fs.pathExists(zipPath);
      if (!exists) {
        console.error(`❌ Package not found: ${zipPath}`);
        return false;
      }

      const stats = await fs.stat(zipPath);
      if (stats.size === 0) {
        console.error(`❌ Package is empty: ${zipPath}`);
        return false;
      }

      console.log(
        `✅ Package validated: ${zipPath} (${(stats.size / 1024 / 1024).toFixed(
          2
        )} MB)`
      );
      return true;
    } catch (error) {
      console.error(`❌ Package validation failed:`, error);
      return false;
    }
  }
}
