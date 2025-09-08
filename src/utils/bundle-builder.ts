import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
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
  sha256?: string; // SHA256 hash for integrity check
}

export class BundleBuilder {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Calculate SHA256 hash of a file
   * @param filePath Path to the file
   * @returns SHA256 hash in hex format
   */
  private async calculateSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => {
        hash.update(data);
      });

      stream.on("end", () => {
        resolve(hash.digest("hex"));
      });

      stream.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Calculate SHA256 hash with prefix format
   * @param filePath Path to the file
   * @returns SHA256 hash with "sha256:" prefix
   */
  private async calculateSHA256WithPrefix(filePath: string): Promise<string> {
    const hash = await this.calculateSHA256(filePath);
    return `sha256:${hash}`;
  }

  /**
   * Verify file integrity using SHA256 hash
   * @param filePath Path to the file
   * @param expectedHash Expected hash in format "sha256:hash" or just "hash"
   * @returns True if hash matches, false otherwise
   */
  async verifyFileIntegrity(
    filePath: string,
    expectedHash: string
  ): Promise<boolean> {
    try {
      const calculatedHash = await this.calculateSHA256(filePath);

      // Remove "sha256:" prefix if present
      const cleanExpectedHash = expectedHash.startsWith("sha256:")
        ? expectedHash.substring(7)
        : expectedHash;

      return calculatedHash === cleanExpectedHash;
    } catch (error) {
      console.error(`Error verifying file integrity for ${filePath}:`, error);
      return false;
    }
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

        // Only calculate SHA256 hash for files, not directories
        let sha256Hash = "";
        if (stats.isFile()) {
          sha256Hash = await this.calculateSHA256(sourcePath);
        }

        const assetFile: AssetFile = {
          name: path.basename(file),
          type: path.extname(file).substring(1),
          httpServerLocation: `assets/${file}`.replace(/\\/g, "/"), // Normalize path separators
          scales: [1], // Default scale
          hash: stats.mtime.getTime().toString(), // Keep legacy hash for backward compatibility
          sha256: sha256Hash, // Add SHA256 hash for integrity check
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

    // Calculate SHA256 hash for the bundle
    let bundleSHA256 = "";
    try {
      bundleSHA256 = await this.calculateSHA256WithPrefix(bundlePath);
      console.log(`🔐 Bundle SHA256: ${bundleSHA256}`);
    } catch (error) {
      console.error(`❌ Failed to calculate SHA256 for ${bundlePath}:`, error);
    }

    const manifest = {
      platform,
      bundleUrl: `bundles/${path.basename(bundlePath)}`,
      bundleSize: bundleStats.size,
      bundleHash: bundleStats.mtime.getTime().toString(), // Keep legacy hash for backward compatibility
      bundleSHA256: bundleSHA256, // Add SHA256 hash for integrity check
      assets,
      timestamp: Date.now(),
      version: require(path.join(this.projectRoot, "package.json")).version,
    };

    const manifestPath = path.join(outputDir, "manifest.json");
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });

    console.log(`📄 Generated manifest: ${manifestPath}`);
    if (bundleSHA256) {
      console.log(`🔐 Bundle SHA256: ${bundleSHA256}`);
    }
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
  ): Promise<{ size: number; hash: string; sha256: string; path: string }> {
    const stats = await fs.stat(bundlePath);
    const sha256Hash = await this.calculateSHA256WithPrefix(bundlePath);

    return {
      size: stats.size,
      hash: stats.mtime.getTime().toString(), // Keep legacy hash for backward compatibility
      sha256: sha256Hash, // Add SHA256 hash for integrity check
      path: bundlePath,
    };
  }
}
