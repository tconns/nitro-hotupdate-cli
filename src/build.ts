import * as fs from "fs-extra";
import * as path from "path";
import { BundleBuilder, BundleConfig, AssetFile } from "./utils/bundle-builder";
import {
  PackageManager,
  ZipConfig,
  PackageInfo,
} from "./utils/package-manager";

export interface HotUpdateConfig {
  projectRoot: string;
  bundleOutput: {
    ios: {
      bundlePath: string;
      assetsDest: string;
      sourcemapOutput?: string;
    };
    android: {
      bundlePath: string;
      assetsDest: string;
      sourcemapOutput?: string;
    };
  };
  metro: {
    entryFile: string;
    dev: boolean;
    minify: boolean;
    resetCache: boolean;
  };
  assets: {
    include: string[];
    exclude: string[];
  };
  zip: ZipConfig;
  version: string;
  description: string;
  platforms: ("ios" | "android")[];
}

export async function buildHotUpdate(configPath: string): Promise<void> {
  console.log("🚀 Starting hot update bundle generation...");

  // Read configuration
  const config: HotUpdateConfig = await fs.readJSON(configPath);
  const projectRoot = path.resolve(config.projectRoot);

  console.log(`📋 Configuration loaded from: ${configPath}`);
  console.log(`📁 Project root: ${projectRoot}`);
  console.log(`🎯 Platforms: ${config.platforms.join(", ")}`);

  const builder = new BundleBuilder(projectRoot);
  const packageManager = new PackageManager(config.zip.outputDir);

  const builtPackages: PackageInfo[] = [];

  // Build bundles for each platform
  for (const platform of config.platforms) {
    console.log(`\n📱 Building ${platform} bundle...`);

    const platformConfig = config.bundleOutput[platform];
    const bundleConfig: BundleConfig = {
      entryFile: config.metro.entryFile,
      bundlePath: path.resolve(projectRoot, platformConfig.bundlePath),
      assetsDest: path.resolve(projectRoot, platformConfig.assetsDest),
      sourcemapOutput: platformConfig.sourcemapOutput
        ? path.resolve(projectRoot, platformConfig.sourcemapOutput)
        : undefined,
      platform,
      dev: config.metro.dev,
      minify: config.metro.minify,
      resetCache: config.metro.resetCache,
    };

    try {
      // Build React Native bundle
      await builder.buildBundle(bundleConfig);

      // Validate bundle
      const isValid = await builder.validateBundle(bundleConfig.bundlePath);
      if (!isValid) {
        throw new Error(`Bundle validation failed for ${platform}`);
      }

      // Copy additional assets
      const copiedAssets = await builder.copyAssets(
        config.assets.include,
        bundleConfig.assetsDest,
        config.assets.exclude
      );

      // Generate manifest
      const outputDir = path.dirname(bundleConfig.bundlePath);
      await builder.generateManifest(
        platform,
        bundleConfig.bundlePath,
        copiedAssets,
        outputDir
      );

      // Create ZIP package if enabled
      if (config.zip.enabled) {
        const packageInfo = await packageManager.createZipPackage(
          outputDir,
          platform,
          config.version,
          config.zip
        );
        builtPackages.push(packageInfo);
      }

      console.log(`✅ ${platform} bundle completed successfully`);
    } catch (error) {
      console.error(`❌ Failed to build ${platform} bundle:`, error);
      throw error;
    }
  }

  // Create combined package if requested and multiple platforms
  if (
    config.zip.enabled &&
    !config.zip.separate &&
    config.platforms.length > 1
  ) {
    const baseOutputDir = path.dirname(
      config.bundleOutput[config.platforms[0]].bundlePath
    );
    const combinedPackage = await packageManager.createCombinedPackage(
      config.platforms,
      config.version,
      config.zip,
      path.dirname(baseOutputDir)
    );
    builtPackages.push(combinedPackage);
  }

  // Generate packages manifest
  if (config.zip.enabled && builtPackages.length > 0) {
    await packageManager.generatePackageManifest(
      builtPackages,
      config.zip.outputDir
    );
  }

  // Generate build summary
  await generateBuildSummary(config, builtPackages, projectRoot);

  console.log("\n🎉 Hot update bundle generation completed!");
  console.log(`📦 Generated ${builtPackages.length} package(s)`);

  if (config.zip.enabled) {
    console.log("\n📁 Package locations:");
    builtPackages.forEach((pkg) => {
      console.log(`  ${pkg.platform}: ${pkg.zipPath}`);
    });
  }
}

async function generateBuildSummary(
  config: HotUpdateConfig,
  packages: PackageInfo[],
  projectRoot: string
): Promise<void> {
  const summaryPath = path.join(
    projectRoot,
    "hotupdate-build",
    "BUILD_SUMMARY.md"
  );

  const summary = `# Hot Update Build Summary

Generated: ${new Date().toISOString()}
Version: ${config.version}
Description: ${config.description}

## Configuration
- **Project Root**: ${config.projectRoot}
- **Entry File**: ${config.metro.entryFile}
- **Platforms**: ${config.platforms.join(", ")}
- **Development Mode**: ${config.metro.dev}
- **Minified**: ${config.metro.minify}

## Build Results

### Bundles Generated
${config.platforms
  .map((platform) => {
    const platformConfig = config.bundleOutput[platform];
    return `- **${platform.toUpperCase()}**
  - Bundle: \`${platformConfig.bundlePath}\`
  - Assets: \`${platformConfig.assetsDest}\`
  ${
    platformConfig.sourcemapOutput
      ? `- Source Map: \`${platformConfig.sourcemapOutput}\``
      : ""
  }`;
  })
  .join("\n")}

${
  packages.length > 0
    ? `### Packages Created
${packages
  .map(
    (pkg) =>
      `- **${pkg.platform}**: \`${path.basename(pkg.zipPath)}\` (${(
        pkg.bundleSize /
        1024 /
        1024
      ).toFixed(2)} MB)`
  )
  .join("\n")}`
    : ""
}

## Integration

### Using the bundles:

1. **Upload to your CDN/Server**
2. **Update your app configuration** to point to the new bundle URLs
3. **Test the hot update** on development devices first

### Bundle URLs format:
- iOS: \`https://your-cdn.com/bundles/ios/${config.version}/main.jsbundle\`
- Android: \`https://your-cdn.com/bundles/android/${
    config.version
  }/index.android.bundle\`

### Example hot update check:
\`\`\`javascript
const hotUpdateConfig = {
  ios: {
    bundleUrl: 'https://your-cdn.com/bundles/ios/${
      config.version
    }/main.jsbundle',
    version: '${config.version}'
  },
  android: {
    bundleUrl: 'https://your-cdn.com/bundles/android/${
      config.version
    }/index.android.bundle', 
    version: '${config.version}'
  }
};
\`\`\`

---
*Generated by nitro-hotupdate-cli*
`;

  await fs.ensureDir(path.dirname(summaryPath));
  await fs.writeFile(summaryPath, summary);

  console.log(`📄 Build summary generated: ${summaryPath}`);
}
