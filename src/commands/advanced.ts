import { Command } from "commander";
import { PromptHelper } from "../utils/prompt-helper";
import { HotUpdateBuilder } from "../utils/hotupdate-builder";
import { BundleBuilder } from "../utils/bundle-builder";

export function createAdvancedCommand(): Command {
  const advanced = new Command("advanced").description(
    "Advanced hot update operations"
  );

  // Build for specific platforms with prompts
  advanced
    .command("build-platform")
    .description("Build hot update bundles for selected platforms")
    .option("-p, --project-path <path>", "Path to React Native project")
    .action(async (opts) => {
      try {
        console.log("🎯 Advanced Platform Build\n");

        // Get project path
        let projectPath = opts.projectPath;
        if (!projectPath) {
          const inquirer = await import("inquirer");
          const { path } = await inquirer.prompt([
            {
              type: "input",
              name: "path",
              message: "Enter React Native project path:",
              default: process.cwd(),
            },
          ]);
          projectPath = path;
        }

        // Select platforms only
        const platforms = await PromptHelper.selectPlatforms();

        // Get basic configuration
        const config = await PromptHelper.promptBuildConfig(projectPath);

        // Override platforms with selected ones
        config.platforms = platforms;

        // Confirm and build
        const confirmed = await PromptHelper.confirmBuildConfig(config);
        if (!confirmed) {
          console.log("❌ Build cancelled");
          return;
        }

        const builder = new HotUpdateBuilder(config);
        const results = await builder.buildAllPlatforms();

        HotUpdateBuilder.getSummary(results);
      } catch (error) {
        console.error("❌ Advanced build failed:", error);
        process.exit(1);
      }
    });

  // Validate existing bundles
  advanced
    .command("validate")
    .description("Validate existing hot update bundles")
    .option("-p, --project-path <path>", "Path to React Native project", "./")
    .option(
      "-b, --build-path <path>",
      "Path to build directory",
      "./hotupdate-build"
    )
    .action(async (opts) => {
      try {
        console.log("🔍 Validating Hot Update Bundles\n");

        const fs = await import("fs-extra");
        const path = await import("path");

        const buildPath = path.resolve(opts.buildPath);

        if (!(await fs.pathExists(buildPath))) {
          console.log("❌ Build directory not found:", buildPath);
          console.log("   Run a build first: nitro-hotupdate build");
          return;
        }

        const bundleBuilder = new BundleBuilder(opts.projectPath);
        let allValid = true;

        // Check each platform
        const items = await fs.readdir(buildPath);
        const platforms = items.filter(async (item) => {
          const itemPath = path.join(buildPath, item);
          return (await fs.stat(itemPath)).isDirectory() && item !== "packages";
        });

        console.log(`📱 Found ${platforms.length} platform build(s)\n`);

        for (const platform of platforms) {
          console.log(`Validating ${platform}:`);

          const platformDir = path.join(buildPath, platform);

          // Check for bundle files
          const bundlesDir = path.join(platformDir, "bundles");
          if (await fs.pathExists(bundlesDir)) {
            const bundleFiles = await fs.readdir(bundlesDir);
            const bundles = bundleFiles.filter(
              (f) => f.includes(".bundle") || f.includes(".jsbundle")
            );

            for (const bundleFile of bundles) {
              const bundlePath = path.join(bundlesDir, bundleFile);
              const isValid = await bundleBuilder.validateBundle(bundlePath);

              if (!isValid) {
                allValid = false;
              }
            }
          } else {
            console.log(`  ❌ No bundles directory found for ${platform}`);
            allValid = false;
          }

          // Check manifest
          const manifestPath = path.join(platformDir, "manifest.json");
          if (await fs.pathExists(manifestPath)) {
            try {
              const manifest = await fs.readJson(manifestPath);
              console.log(`  ✅ Manifest valid (version: ${manifest.version})`);
            } catch (error) {
              console.log(`  ❌ Invalid manifest.json: ${error}`);
              allValid = false;
            }
          } else {
            console.log(`  ❌ No manifest.json found for ${platform}`);
            allValid = false;
          }

          console.log("");
        }

        // Check ZIP packages
        const packagesDir = path.join(buildPath, "packages");
        if (await fs.pathExists(packagesDir)) {
          const packages = await fs.readdir(packagesDir);
          const zipFiles = packages.filter((f) => f.endsWith(".zip"));

          console.log(`📦 Found ${zipFiles.length} ZIP package(s):`);
          for (const zipFile of zipFiles) {
            const zipPath = path.join(packagesDir, zipFile);
            const stats = await fs.stat(zipPath);
            const size = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`  ✅ ${zipFile} (${size} MB)`);
          }
        }

        console.log("\n" + "=".repeat(50));
        if (allValid) {
          console.log("🎉 All validations passed!");
        } else {
          console.log("❌ Some validations failed. Check the errors above.");
          process.exit(1);
        }
      } catch (error) {
        console.error("❌ Validation failed:", error);
        process.exit(1);
      }
    });

  // Compare bundle sizes
  advanced
    .command("compare")
    .description("Compare bundle sizes between platforms or versions")
    .option(
      "-b, --build-path <path>",
      "Path to build directory",
      "./hotupdate-build"
    )
    .action(async (opts) => {
      try {
        console.log("📊 Bundle Size Comparison\n");

        const fs = await import("fs-extra");
        const path = await import("path");

        const buildPath = path.resolve(opts.buildPath);

        if (!(await fs.pathExists(buildPath))) {
          console.log("❌ Build directory not found:", buildPath);
          return;
        }

        const bundleData: Array<{
          platform: string;
          bundleFile: string;
          size: number;
          path: string;
        }> = [];

        // Collect bundle information
        const items = await fs.readdir(buildPath);
        const platforms = items.filter(async (item) => {
          const itemPath = path.join(buildPath, item);
          return (await fs.stat(itemPath)).isDirectory() && item !== "packages";
        });

        for (const platform of platforms) {
          const bundlesDir = path.join(buildPath, platform, "bundles");
          if (await fs.pathExists(bundlesDir)) {
            const bundleFiles = await fs.readdir(bundlesDir);
            const bundles = bundleFiles.filter(
              (f) => f.includes(".bundle") || f.includes(".jsbundle")
            );

            for (const bundleFile of bundles) {
              const bundlePath = path.join(bundlesDir, bundleFile);
              const stats = await fs.stat(bundlePath);

              bundleData.push({
                platform,
                bundleFile,
                size: stats.size,
                path: bundlePath,
              });
            }
          }
        }

        if (bundleData.length === 0) {
          console.log("❌ No bundles found to compare");
          return;
        }

        // Sort by size
        bundleData.sort((a, b) => b.size - a.size);

        console.log("Bundle sizes (largest to smallest):");
        console.log("─".repeat(60));

        for (const bundle of bundleData) {
          const sizeMB = (bundle.size / 1024 / 1024).toFixed(2);
          const sizeKB = (bundle.size / 1024).toFixed(1);
          console.log(
            `📱 ${bundle.platform.padEnd(8)} │ ${sizeMB.padStart(
              6
            )} MB (${sizeKB} KB) │ ${bundle.bundleFile}`
          );
        }

        // Show statistics
        const sizes = bundleData.map((b) => b.size);
        const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
        const maxSize = Math.max(...sizes);
        const minSize = Math.min(...sizes);

        console.log("\n📈 Statistics:");
        console.log(`   Average: ${(avgSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Largest: ${(maxSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Smallest: ${(minSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(
          `   Difference: ${((maxSize - minSize) / 1024 / 1024).toFixed(2)} MB`
        );
      } catch (error) {
        console.error("❌ Comparison failed:", error);
        process.exit(1);
      }
    });

  // Clean build artifacts
  advanced
    .command("clean")
    .description("Clean build artifacts and temporary files")
    .option(
      "-b, --build-path <path>",
      "Path to build directory",
      "./hotupdate-build"
    )
    .option("--all", "Clean everything including packages", false)
    .action(async (opts) => {
      try {
        const fs = await import("fs-extra");
        const path = await import("path");
        const inquirer = await import("inquirer");

        const buildPath = path.resolve(opts.buildPath);

        if (!(await fs.pathExists(buildPath))) {
          console.log("✅ Nothing to clean - build directory does not exist");
          return;
        }

        console.log("🧹 Cleaning Build Artifacts\n");

        // Show what will be cleaned
        const items = await fs.readdir(buildPath);
        console.log("The following will be cleaned:");

        for (const item of items) {
          if (item === "packages" && !opts.all) {
            console.log(`  📦 ${item}/ (kept - use --all to remove)`);
          } else {
            console.log(`  🗑️  ${item}/`);
          }
        }

        // Confirm cleanup
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: "Are you sure you want to clean these files?",
            default: false,
          },
        ]);

        if (!confirm) {
          console.log("❌ Cleanup cancelled");
          return;
        }

        // Perform cleanup
        for (const item of items) {
          if (item === "packages" && !opts.all) {
            continue;
          }

          const itemPath = path.join(buildPath, item);
          await fs.remove(itemPath);
          console.log(`✅ Removed: ${item}`);
        }

        // Remove build directory if empty
        const remainingItems = await fs.readdir(buildPath);
        if (remainingItems.length === 0) {
          await fs.remove(buildPath);
          console.log("✅ Removed empty build directory");
        }

        console.log("\n🎉 Cleanup completed!");
      } catch (error) {
        console.error("❌ Cleanup failed:", error);
        process.exit(1);
      }
    });

  return advanced;
}
