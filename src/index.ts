#!/usr/bin/env node
import { Command } from "commander";
import { PromptHelper, SignatureConfig } from "./utils/prompt-helper";
import { HotUpdateBuilder } from "./utils/hotupdate-builder";
import { DigitalSignature } from "./utils/digital-signature";
import { ConfigLoader } from "./utils/config-loader";
import { createAdvancedCommand } from "./commands/advanced";

const program = new Command();

program
  .name("nitro-hotupdate")
  .description(
    "Build separate JS bundles and assets for React Native hot update functionality"
  )
  .version("1.0.0");

// Main build command (interactive)
program
  .command("build")
  .description(
    "Build hot update bundles and assets for specified platforms (interactive)"
  )
  .option(
    "-p, --project-path <path>",
    "Path to React Native project (optional - will prompt if not provided)"
  )
  .option("--verbose", "Enable verbose logging", false)
  .action(async (opts) => {
    try {
      console.log("🚀 Nitro Hot Update CLI\n");

      // Get build configuration through prompts
      const config = await PromptHelper.promptBuildConfig(opts.projectPath);

      // Show configuration and confirm
      const confirmed = await PromptHelper.confirmBuildConfig(config);
      if (!confirmed) {
        console.log("❌ Build cancelled by user");
        process.exit(0);
      }

      // Build bundles
      const signatureConfig = config.signature?.enabled
        ? {
            algorithm: config.signature.algorithm || "RSA-SHA256",
            keySize: config.signature.algorithm === "RSA-SHA256" ? 2048 : 256,
          }
        : undefined;

      const builder = new HotUpdateBuilder(config, signatureConfig);
      const results = await builder.buildAllPlatforms();

      // Show summary
      HotUpdateBuilder.getSummary(results);

      // Check if any builds failed
      const failedBuilds = results.filter((r) => !r.success);
      if (failedBuilds.length > 0) {
        console.log("⚠️  Some builds failed. Check the errors above.");
        process.exit(1);
      }

      console.log("🎉 All builds completed successfully!");
      console.log("\n📚 Next steps:");
      console.log("  1. Test the generated bundles in your app");
      console.log("  2. Upload ZIP files to your hot update server");
      console.log(
        "  3. Update your app's manifest URL to point to the new version"
      );
    } catch (error) {
      console.error("❌ Build failed:", error);
      process.exit(1);
    }
  });

// Signature commands
const signatureCmd = program
  .command("signature")
  .description("Digital signature management commands");

// Generate key pair
signatureCmd
  .command("generate-keys")
  .description("Generate RSA/ECDSA key pair for signing")
  .option(
    "-a, --algorithm <algorithm>",
    "Algorithm (RSA-SHA256|ECDSA-SHA256)",
    "RSA-SHA256"
  )
  .option(
    "-s, --key-size <size>",
    "Key size (2048,3072,4096 for RSA; 256,384,521 for ECDSA)",
    "2048"
  )
  .option("-o, --output <dir>", "Output directory for keys", "./keys")
  .option("-n, --name <name>", "Key pair name", "hotupdate")
  .action(async (opts) => {
    try {
      const keySize = parseInt(opts.keySize);
      const signatureConfig = {
        algorithm: opts.algorithm as "RSA-SHA256" | "ECDSA-SHA256",
        keySize,
      };

      const digitalSignature = new DigitalSignature(signatureConfig);
      const result = await digitalSignature.generateAndSaveKeyPair(
        opts.output,
        opts.name
      );

      console.log("🔐 Key pair generated successfully!");
      console.log(`   Algorithm: ${opts.algorithm}`);
      console.log(`   Key size: ${keySize}`);
      console.log(`   Private key: ${result.privateKeyPath}`);
      console.log(`   Public key: ${result.publicKeyPath}`);
      console.log("\n⚠️  Important:");
      console.log("   - Keep your private key secure and never share it");
      console.log("   - Back up your keys in a secure location");
      console.log("   - Distribute the public key to verify signatures");
    } catch (error) {
      console.error("❌ Failed to generate keys:", error);
      process.exit(1);
    }
  });

// Sign manifest
signatureCmd
  .command("sign")
  .description("Sign a manifest.json file")
  .requiredOption("-m, --manifest <path>", "Path to manifest.json file")
  .requiredOption("-k, --private-key <path>", "Path to private key file")
  .action(async (opts) => {
    try {
      const digitalSignature = new DigitalSignature();
      const result = await digitalSignature.signManifest(
        opts.manifest,
        opts.privateKey
      );

      console.log("🔐 Manifest signed successfully!");
      console.log(`   Algorithm: ${result.algorithm}`);
      console.log(`   Signature: ${result.signature.substring(0, 50)}...`);
      console.log(`   Timestamp: ${new Date(result.timestamp).toISOString()}`);
    } catch (error) {
      console.error("❌ Failed to sign manifest:", error);
      process.exit(1);
    }
  });

// Verify signature
signatureCmd
  .command("verify")
  .description("Verify a signed manifest.json file")
  .requiredOption("-m, --manifest <path>", "Path to manifest.json file")
  .option(
    "-k, --public-key <path>",
    "Path to public key file (optional if embedded in manifest)"
  )
  .action(async (opts) => {
    try {
      const digitalSignature = new DigitalSignature();
      const result = await digitalSignature.verifyManifest(
        opts.manifest,
        opts.publicKey
      );

      if (result.isValid) {
        console.log("✅ Signature verification successful!");
        console.log(`   Algorithm: ${result.algorithm}`);
        if (result.timestamp) {
          console.log(`   Signed: ${new Date(result.timestamp).toISOString()}`);
        }
      } else {
        console.log("❌ Signature verification failed!");
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Verification failed:", error);
      process.exit(1);
    }
  });

// Build from config file command
program
  .command("build-config")
  .description("Build using configuration from hotupdate.config.json")
  .option("-c, --config <path>", "Path to config file", "hotupdate.config.json")
  .option("--dry-run", "Show configuration without building", false)
  .action(async (opts) => {
    try {
      console.log("🚀 Nitro Hot Update CLI - Config Mode\n");

      // Load configuration
      console.log(`📄 Loading configuration: ${opts.config}`);
      const hotUpdateConfig = await ConfigLoader.loadConfig(opts.config);

      // Display config summary
      ConfigLoader.displayConfigSummary(hotUpdateConfig);

      if (opts.dryRun) {
        console.log("\n✅ Dry run completed - configuration is valid");
        return;
      }

      // Convert to BuildConfig
      const buildConfig = await ConfigLoader.toBuildConfig(hotUpdateConfig);

      // Build bundles
      const signatureConfig = buildConfig.signature?.enabled
        ? {
            algorithm: buildConfig.signature.algorithm || "RSA-SHA256",
            keySize:
              buildConfig.signature.algorithm === "RSA-SHA256" ? 2048 : 256,
          }
        : undefined;

      const builder = new HotUpdateBuilder(buildConfig, signatureConfig);
      const results = await builder.buildAllPlatforms();

      // Show summary
      HotUpdateBuilder.getSummary(results);

      // Check if any builds failed
      const failedBuilds = results.filter((r) => !r.success);
      if (failedBuilds.length > 0) {
        process.exit(1);
      }

      console.log("🎉 Build from config completed successfully!");
    } catch (error) {
      console.error("❌ Config build failed:", error);
      process.exit(1);
    }
  });

// Quick build command (for CI/CD)
program
  .command("build-ci")
  .description("Build with minimal prompts (for CI/CD)")
  .requiredOption("-p, --project-path <path>", "Path to React Native project")
  .option(
    "--platforms <platforms>",
    "Comma-separated platforms (ios,android)",
    "ios,android"
  )
  .option(
    "--version <version>",
    "Version number (defaults to package.json version)"
  )
  .option("--output <path>", "Output directory", "./hotupdate-build")
  .option("--bundle-name <name>", "Bundle name", "index")
  .option("--sourcemap", "Generate source maps", false)
  .option("--no-minify", "Disable minification", false)
  .option("--signature", "Enable digital signature", false)
  .option(
    "--signature-algorithm <algorithm>",
    "Signature algorithm (RSA-SHA256|ECDSA-SHA256)",
    "RSA-SHA256"
  )
  .option("--private-key <path>", "Path to private key for signing")
  .action(async (opts) => {
    try {
      // Parse platforms
      const platforms = opts.platforms.split(",").map((p: string) => p.trim());

      // Validate platforms
      for (const platform of platforms) {
        if (!["ios", "android"].includes(platform)) {
          console.error(`❌ Invalid platform: ${platform}`);
          process.exit(1);
        }
      }

      // Get version from package.json if not specified
      let version = opts.version;
      if (!version) {
        const fs = await import("fs-extra");
        const path = await import("path");
        const packageJsonPath = path.join(opts.projectPath, "package.json");

        if (await fs.pathExists(packageJsonPath)) {
          const packageJson = await fs.readJson(packageJsonPath);
          version = packageJson.version || "1.0.0";
        } else {
          version = "1.0.0";
        }
      }

      const config = {
        platforms: platforms as ("ios" | "android")[],
        version,
        projectPath: opts.projectPath,
        outputPath: opts.output,
        bundleName: opts.bundleName,
        sourcemap: opts.sourcemap,
        minify: !opts.noMinify,
        signature: opts.signature
          ? {
              enabled: true,
              algorithm: opts.signatureAlgorithm as
                | "RSA-SHA256"
                | "ECDSA-SHA256",
              privateKeyPath: opts.privateKey,
              autoGenerate: !opts.privateKey, // Auto-generate if no private key provided
            }
          : undefined,
      };

      console.log("🏗️  Building with configuration:");
      console.log(`   Platforms: ${config.platforms.join(", ")}`);
      console.log(`   Version: ${config.version}`);
      console.log(`   Project: ${config.projectPath}`);
      console.log(`   Output: ${config.outputPath}\n`);

      // Build bundles
      const signatureConfig = config.signature?.enabled
        ? {
            algorithm: config.signature.algorithm || "RSA-SHA256",
            keySize: config.signature.algorithm === "RSA-SHA256" ? 2048 : 256,
          }
        : undefined;

      const builder = new HotUpdateBuilder(config, signatureConfig);
      const results = await builder.buildAllPlatforms();

      // Show summary
      HotUpdateBuilder.getSummary(results);

      // Check if any builds failed
      const failedBuilds = results.filter((r) => !r.success);
      if (failedBuilds.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Build failed:", error);
      process.exit(1);
    }
  });

// Add advanced commands
program.addCommand(createAdvancedCommand());

// Config management commands
const configCmd = program
  .command("config")
  .description("Configuration file management commands");

// Generate example config
configCmd
  .command("init")
  .description("Generate example hotupdate.config.json file")
  .option("-o, --output <path>", "Output file path", "hotupdate.config.json")
  .option("--force", "Overwrite existing config file", false)
  .action(async (opts) => {
    try {
      const fs = await import("fs-extra");

      if ((await fs.pathExists(opts.output)) && !opts.force) {
        console.error(`❌ Config file already exists: ${opts.output}`);
        console.log(
          "   Use --force to overwrite or specify different output path"
        );
        process.exit(1);
      }

      await ConfigLoader.generateExampleConfig(opts.output);

      console.log("✅ Example configuration generated!");
      console.log("\n📝 Next steps:");
      console.log("   1. Edit the configuration file to match your project");
      console.log("   2. Run: nitro-hotupdate build-config");
      console.log(
        "\n💡 Use --dry-run to validate configuration without building"
      );
    } catch (error) {
      console.error("❌ Failed to generate config:", error);
      process.exit(1);
    }
  });

// Validate config
configCmd
  .command("validate")
  .description("Validate hotupdate.config.json file")
  .option("-c, --config <path>", "Path to config file", "hotupdate.config.json")
  .action(async (opts) => {
    try {
      console.log(`🔍 Validating configuration: ${opts.config}`);

      const hotUpdateConfig = await ConfigLoader.loadConfig(opts.config);
      ConfigLoader.displayConfigSummary(hotUpdateConfig);

      console.log("\n✅ Configuration is valid!");
    } catch (error) {
      console.error("❌ Configuration validation failed:", error);
      process.exit(1);
    }
  });

// Quick start command
program
  .command("init")
  .description("Initialize a sample React Native project structure for testing")
  .option("-n, --name <name>", "Project name", "MyApp")
  .option("--entry <path>", "Entry file path", "index.js")
  .action(async (opts) => {
    const fs = await import("fs-extra");
    const path = await import("path");

    console.log("🚀 Initializing sample React Native project structure...");

    // Create basic package.json
    const packageJson = {
      name: opts.name.toLowerCase(),
      version: "1.0.0",
      scripts: {
        hotupdate: "nitro-hotupdate build",
      },
      dependencies: {
        react: "18.2.0",
        "react-native": "0.72.0",
      },
    };

    await fs.writeJSON("./package.json", packageJson, { spaces: 2 });

    // Create entry file
    const entryContent = `import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
`;

    await fs.writeFile(`./${opts.entry}`, entryContent);

    // Create basic App.js
    const appContent = `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello, Hot Update!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  text: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});

export default App;
`;

    await fs.writeFile("./App.js", appContent);

    // Create app.json
    const appJson = {
      name: opts.name,
      displayName: opts.name,
    };

    await fs.writeJSON("./app.json", appJson, { spaces: 2 });

    // Create assets directory
    await fs.ensureDir("./assets");

    console.log("✅ Sample project structure created!");
    console.log("\nFiles created:");
    console.log("  📄 package.json");
    console.log("  📄 index.js");
    console.log("  📄 App.js");
    console.log("  📄 app.json");
    console.log("  📁 assets/");
    console.log("\nNext steps:");
    console.log("1. Run: nitro-hotupdate build");
    console.log("2. Follow the interactive prompts");
  });

// Info command
program
  .command("info")
  .description("Show project information and build status")
  .option("-p, --project-path <path>", "Project path to analyze", "./")
  .action(async (opts) => {
    const fs = await import("fs-extra");
    const path = await import("path");

    try {
      console.log("ℹ️  Nitro Hot Update Information\n");

      const projectPath = path.resolve(opts.projectPath);

      // Check if it's a React Native project
      const packageJsonPath = path.join(projectPath, "package.json");
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);

        console.log("📋 Project Information:");
        console.log(`  Name: ${packageJson.name}`);
        console.log(`  Version: ${packageJson.version}`);
        console.log(
          `  React Native: ${
            packageJson.dependencies?.["react-native"] ? "✅" : "❌"
          }`
        );

        // Check for entry files
        const entryFiles = ["index.js", "index.ts", "index.jsx", "index.tsx"];
        const foundEntry = entryFiles.find((entry) =>
          fs.existsSync(path.join(projectPath, entry))
        );

        console.log(
          `  Entry file: ${foundEntry || "Not found"} ${
            foundEntry ? "✅" : "❌"
          }`
        );
      } else {
        console.log("❌ No package.json found");
        console.log("   This doesn't appear to be a React Native project");
      }

      // Check build status
      console.log("\n🔧 Build Status:");
      const buildDir = path.join(projectPath, "hotupdate-build");

      if (await fs.pathExists(buildDir)) {
        const items = await fs.readdir(buildDir);
        const platforms = items.filter(async (item) => {
          const itemPath = path.join(buildDir, item);
          return (await fs.stat(itemPath)).isDirectory() && item !== "packages";
        });

        console.log(`  Build directory exists: ✅`);
        console.log(`  Platform builds: ${platforms.length}`);

        // Check for ZIP packages
        const packagesDir = path.join(buildDir, "packages");
        if (await fs.pathExists(packagesDir)) {
          const packages = await fs.readdir(packagesDir);
          const zipFiles = packages.filter((f) => f.endsWith(".zip"));
          console.log(`  ZIP packages: ${zipFiles.length}`);

          if (zipFiles.length > 0) {
            console.log("\n📦 Available packages:");
            for (const zipFile of zipFiles) {
              const zipPath = path.join(packagesDir, zipFile);
              const stats = await fs.stat(zipPath);
              const size = (stats.size / 1024 / 1024).toFixed(2);
              console.log(`    ${zipFile} (${size} MB)`);
            }
          }
        }
      } else {
        console.log("  No builds found");
        console.log("  Run 'nitro-hotupdate build' to create bundles");
      }
    } catch (error) {
      console.error("❌ Error reading information:", error);
    }
  });

program.parse(process.argv);
