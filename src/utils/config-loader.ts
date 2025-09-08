import fs from "fs-extra";
import path from "path";
import semver from "semver";
import { BuildConfig } from "./prompt-helper";

export interface HotUpdateConfig {
  project: {
    path: string;
    entryFile?: string;
  };
  build: {
    platforms: ("ios" | "android")[];
    version?: string;
    outputPath: string;
    bundleName?: string;
    sourcemap?: boolean;
    minify?: boolean;
  };
  signature?: {
    enabled: boolean;
    algorithm?: "RSA-SHA256" | "ECDSA-SHA256";
    privateKeyPath?: string;
    publicKeyPath?: string;
    autoGenerate?: boolean;
  };
  metadata?: {
    description?: string;
    author?: string;
    homepage?: string;
  };
}

export const DEFAULT_CONFIG: HotUpdateConfig = {
  project: {
    path: "./",
  },
  build: {
    platforms: ["ios", "android"],
    outputPath: "./hotupdate-build",
    bundleName: "index",
    sourcemap: false,
    minify: true,
  },
  signature: {
    enabled: false,
    algorithm: "RSA-SHA256",
    autoGenerate: true,
  },
  metadata: {
    description: "Hot update configuration",
    author: "",
    homepage: "",
  },
};

export class ConfigLoader {
  /**
   * Load configuration from hotupdate.config.json
   */
  static async loadConfig(configPath?: string): Promise<HotUpdateConfig> {
    const configFile = configPath || "hotupdate.config.json";

    if (!(await fs.pathExists(configFile))) {
      throw new Error(`Configuration file not found: ${configFile}`);
    }

    try {
      const configContent = await fs.readJSON(configFile);
      const config = this.mergeWithDefaults(configContent);
      await this.validateConfig(config);
      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load config: ${error.message}`);
      }
      throw new Error(`Failed to load config: ${String(error)}`);
    }
  }

  /**
   * Merge user config with defaults
   */
  private static mergeWithDefaults(
    userConfig: Partial<HotUpdateConfig>
  ): HotUpdateConfig {
    return {
      project: {
        ...DEFAULT_CONFIG.project,
        ...userConfig.project,
      },
      build: {
        ...DEFAULT_CONFIG.build,
        ...userConfig.build,
      },
      signature: userConfig.signature?.enabled
        ? {
            ...DEFAULT_CONFIG.signature,
            ...userConfig.signature,
          }
        : undefined,
      metadata: {
        ...DEFAULT_CONFIG.metadata,
        ...userConfig.metadata,
      },
    };
  }

  /**
   * Validate configuration
   */
  private static async validateConfig(config: HotUpdateConfig): Promise<void> {
    // Validate project path
    const projectPath = path.resolve(config.project.path);
    if (!(await fs.pathExists(projectPath))) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Check if it's a React Native project
    const packageJsonPath = path.join(projectPath, "package.json");
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJSON(packageJsonPath);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (
        !dependencies["react-native"] &&
        !dependencies["@react-native-community/cli"]
      ) {
        throw new Error(`Not a React Native project: ${projectPath}`);
      }
    } else {
      throw new Error(`package.json not found in project: ${projectPath}`);
    }

    // Validate platforms
    const validPlatforms = ["ios", "android"];
    for (const platform of config.build.platforms) {
      if (!validPlatforms.includes(platform)) {
        throw new Error(
          `Invalid platform: ${platform}. Valid platforms: ${validPlatforms.join(
            ", "
          )}`
        );
      }
    }

    // Validate version format if provided
    if (config.build.version && !semver.valid(config.build.version)) {
      throw new Error(
        `Invalid version format: ${config.build.version}. Use semantic versioning (e.g., 1.0.0)`
      );
    }

    // Validate signature config
    if (config.signature?.enabled) {
      const validAlgorithms = ["RSA-SHA256", "ECDSA-SHA256"];
      if (
        config.signature.algorithm &&
        !validAlgorithms.includes(config.signature.algorithm)
      ) {
        throw new Error(
          `Invalid signature algorithm: ${
            config.signature.algorithm
          }. Valid algorithms: ${validAlgorithms.join(", ")}`
        );
      }

      // Check private key exists if specified and not auto-generate
      if (!config.signature.autoGenerate && config.signature.privateKeyPath) {
        const keyPath = path.resolve(config.signature.privateKeyPath);
        if (!(await fs.pathExists(keyPath))) {
          console.warn(
            `⚠️  Private key not found: ${keyPath}. Will be auto-generated.`
          );
        }
      }
    }
  }

  /**
   * Convert HotUpdateConfig to BuildConfig
   */
  static async toBuildConfig(config: HotUpdateConfig): Promise<BuildConfig> {
    // Get version from package.json if not specified
    let version = config.build.version;
    if (!version) {
      const packageJsonPath = path.join(config.project.path, "package.json");
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJSON(packageJsonPath);
        version = packageJson.version || "1.0.0";
      } else {
        version = "1.0.0";
      }
    }

    return {
      platforms: config.build.platforms,
      version: version!,
      projectPath: path.resolve(config.project.path),
      outputPath: path.resolve(config.build.outputPath),
      bundleName: config.build.bundleName,
      sourcemap: config.build.sourcemap,
      minify: config.build.minify,
      signature: config.signature?.enabled
        ? {
            enabled: true,
            algorithm: config.signature.algorithm || "RSA-SHA256",
            privateKeyPath: config.signature.privateKeyPath
              ? path.resolve(config.signature.privateKeyPath)
              : undefined,
            publicKeyPath: config.signature.publicKeyPath
              ? path.resolve(config.signature.publicKeyPath)
              : undefined,
            autoGenerate: config.signature.autoGenerate ?? true,
          }
        : undefined,
    };
  }

  /**
   * Generate example config file
   */
  static async generateExampleConfig(
    outputPath: string = "./hotupdate.config.json"
  ): Promise<void> {
    const exampleConfig: HotUpdateConfig = {
      project: {
        path: "./",
        entryFile: "index.js",
      },
      build: {
        platforms: ["ios", "android"],
        version: "1.0.0",
        outputPath: "./hotupdate-build",
        bundleName: "index",
        sourcemap: false,
        minify: true,
      },
      signature: {
        enabled: true,
        algorithm: "RSA-SHA256",
        privateKeyPath: "./keys/hotupdate_private.pem",
        publicKeyPath: "./keys/hotupdate_public.pem",
        autoGenerate: true,
      },
      metadata: {
        description: "Hot update configuration for MyApp",
        author: "Your Name",
        homepage: "https://github.com/yourusername/yourapp",
      },
    };

    await fs.writeJSON(outputPath, exampleConfig, { spaces: 2 });
    console.log(`📄 Example config generated: ${outputPath}`);
  }

  /**
   * Display config summary
   */
  static displayConfigSummary(config: HotUpdateConfig): void {
    console.log("📋 Configuration Summary:");
    console.log(`   Project: ${config.project.path}`);
    console.log(`   Platforms: ${config.build.platforms.join(", ")}`);
    console.log(`   Version: ${config.build.version || "from package.json"}`);
    console.log(`   Output: ${config.build.outputPath}`);
    console.log(`   Bundle: ${config.build.bundleName || "index"}`);
    console.log(`   Source maps: ${config.build.sourcemap ? "Yes" : "No"}`);
    console.log(`   Minify: ${config.build.minify ? "Yes" : "No"}`);

    if (config.signature?.enabled) {
      console.log(`   Digital signature: Yes (${config.signature.algorithm})`);
      if (config.signature.autoGenerate) {
        console.log(`   Private key: Auto-generate`);
      } else if (config.signature.privateKeyPath) {
        console.log(`   Private key: ${config.signature.privateKeyPath}`);
      }
    } else {
      console.log(`   Digital signature: No`);
    }

    if (config.metadata?.description) {
      console.log(`   Description: ${config.metadata.description}`);
    }
  }
}
