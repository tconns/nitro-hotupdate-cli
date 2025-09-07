import * as fs from "fs-extra";
import * as path from "path";
import { spawn } from "child_process";
import { glob } from "glob";

export interface BundleConfig {
  entryFile: string;
  bundlePath: string;
  assetsDest: string;
  sourcemapOutput?: string;
  platform: "ios" | "android";
  dev: boolean;
  minify: boolean;
  resetCache: boolean;
}

export interface AssetFile {
  name: string;
  type: string;
  httpServerLocation: string;
  width?: number;
  height?: number;
  scales: number[];
  hash: string;
}

export class BundleBuilder {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async buildBundle(config: BundleConfig): Promise<void> {
    console.log(`📦 Building ${config.platform} bundle...`);

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(config.bundlePath));
    await fs.ensureDir(config.assetsDest);

    // Build React Native bundle using Metro
    const args = [
      "bundle",
      "--entry-file",
      config.entryFile,
      "--platform",
      config.platform,
      "--bundle-output",
      config.bundlePath,
      "--assets-dest",
      config.assetsDest,
      "--dev",
      config.dev.toString(),
      "--minify",
      config.minify.toString(),
    ];

    if (config.resetCache) {
      args.push("--reset-cache");
    }

    if (config.sourcemapOutput) {
      args.push("--sourcemap-output", config.sourcemapOutput);
    }

    return new Promise((resolve, reject) => {
      // On Windows, we need to use npx.cmd or add shell option
      const isWindows = process.platform === "win32";
      const command = isWindows ? "npx.cmd" : "npx";

      const child = spawn(command, ["react-native", ...args], {
        cwd: this.projectRoot,
        stdio: "inherit",
        shell: isWindows, // Use shell on Windows
      });

      child.on("close", (code) => {
        if (code === 0) {
          console.log(`✅ ${config.platform} bundle built successfully`);
          resolve();
        } else {
          reject(new Error(`Bundle build failed with code ${code}`));
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  async copyAssets(
    sourcePatterns: string[],
    destDir: string,
    excludePatterns: string[] = []
  ): Promise<AssetFile[]> {
    console.log("📁 Copying additional assets...");

    const copiedAssets: AssetFile[] = [];

    for (const pattern of sourcePatterns) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: excludePatterns,
      });

      for (const file of files) {
        const sourcePath = path.join(this.projectRoot, file);
        const destPath = path.join(destDir, file);

        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);

        const stats = await fs.stat(sourcePath);
        const assetFile: AssetFile = {
          name: path.basename(file),
          type: path.extname(file).substring(1),
          httpServerLocation: `assets/${file}`.replace(/\\/g, "/"), // Normalize path separators
          scales: [1], // Default scale
          hash: stats.mtime.getTime().toString(),
        };

        copiedAssets.push(assetFile);
      }
    }

    console.log(`✅ Copied ${copiedAssets.length} assets`);
    return copiedAssets;
  }

  async generateManifest(
    platform: string,
    bundlePath: string,
    assets: AssetFile[],
    outputDir: string
  ): Promise<void> {
    const bundleStats = await fs.stat(bundlePath);

    const manifest = {
      platform,
      bundleUrl: `bundles/${path.basename(bundlePath)}`,
      bundleSize: bundleStats.size,
      bundleHash: bundleStats.mtime.getTime().toString(),
      assets,
      timestamp: Date.now(),
      version: require(path.join(this.projectRoot, "package.json")).version,
    };

    const manifestPath = path.join(outputDir, "manifest.json");
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });

    console.log(`📄 Generated manifest: ${manifestPath}`);
  }

  async validateBundle(bundlePath: string): Promise<boolean> {
    try {
      const exists = await fs.pathExists(bundlePath);
      if (!exists) {
        console.error(`❌ Bundle not found: ${bundlePath}`);
        return false;
      }

      const stats = await fs.stat(bundlePath);
      if (stats.size === 0) {
        console.error(`❌ Bundle is empty: ${bundlePath}`);
        return false;
      }

      console.log(
        `✅ Bundle validated: ${bundlePath} (${(
          stats.size /
          1024 /
          1024
        ).toFixed(2)} MB)`
      );
      return true;
    } catch (error) {
      console.error(`❌ Bundle validation failed:`, error);
      return false;
    }
  }

  async getBundleInfo(
    bundlePath: string
  ): Promise<{ size: number; hash: string; path: string }> {
    const stats = await fs.stat(bundlePath);
    return {
      size: stats.size,
      hash: stats.mtime.getTime().toString(),
      path: bundlePath,
    };
  }
}
