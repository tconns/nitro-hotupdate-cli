import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import semver from "semver";

export interface BuildConfig {
  platforms: ("ios" | "android")[];
  version: string;
  projectPath: string;
  outputPath: string;
  bundleName?: string;
  sourcemap?: boolean;
  minify?: boolean;
}

export class PromptHelper {
  /**
   * Prompt user for build configuration
   */
  static async promptBuildConfig(projectPath?: string): Promise<BuildConfig> {
    console.log("🚀 Nitro Hot Update CLI\n");

    // Detect project path if not provided
    const detectedProjectPath = projectPath || (await this.detectProjectPath());

    // Read package.json to get current version
    const packageJsonPath = path.join(detectedProjectPath, "package.json");
    let currentVersion = "1.0.0";

    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        currentVersion = packageJson.version || "1.0.0";
      } catch (error) {
        console.warn("⚠️  Could not read package.json, using default version");
      }
    }

    const answers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "platforms",
        message: "Which platforms do you want to build for?",
        choices: [
          { name: "iOS", value: "ios" },
          { name: "Android", value: "android" },
        ],
        default: ["ios", "android"],
        validate: (input) => {
          if (input.length === 0) {
            return "Please select at least one platform";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "versionAction",
        message: "How do you want to set the version?",
        choices: [
          { name: `Use current version (${currentVersion})`, value: "current" },
          { name: "Bump patch version", value: "patch" },
          { name: "Bump minor version", value: "minor" },
          { name: "Bump major version", value: "major" },
          { name: "Enter custom version", value: "custom" },
        ],
        default: "current",
      },
      {
        type: "input",
        name: "customVersion",
        message: "Enter version:",
        when: (answers) => answers.versionAction === "custom",
        validate: (input) => {
          if (!semver.valid(input)) {
            return "Please enter a valid semantic version (e.g., 1.0.0)";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "bundleName",
        message: "Bundle name (optional):",
        default: "index",
      },
      {
        type: "input",
        name: "outputPath",
        message: "Output directory:",
        default: "./hotupdate-build",
        validate: (input) => {
          if (!input.trim()) {
            return "Output path cannot be empty";
          }
          return true;
        },
      },
      {
        type: "confirm",
        name: "sourcemap",
        message: "Generate source maps?",
        default: false,
      },
      {
        type: "confirm",
        name: "minify",
        message: "Minify bundle?",
        default: true,
      },
    ]);

    // Calculate version based on user choice
    let finalVersion = currentVersion;
    switch (answers.versionAction) {
      case "patch":
        finalVersion = semver.inc(currentVersion, "patch") || currentVersion;
        break;
      case "minor":
        finalVersion = semver.inc(currentVersion, "minor") || currentVersion;
        break;
      case "major":
        finalVersion = semver.inc(currentVersion, "major") || currentVersion;
        break;
      case "custom":
        finalVersion = answers.customVersion;
        break;
      default:
        finalVersion = currentVersion;
    }

    return {
      platforms: answers.platforms,
      version: finalVersion,
      projectPath: detectedProjectPath,
      outputPath: path.resolve(answers.outputPath),
      bundleName: answers.bundleName || undefined,
      sourcemap: answers.sourcemap,
      minify: answers.minify,
    };
  }

  /**
   * Detect React Native project path
   */
  private static async detectProjectPath(): Promise<string> {
    const currentDir = process.cwd();

    // Check if current directory is a React Native project
    if (await this.isReactNativeProject(currentDir)) {
      return currentDir;
    }

    // Ask user to specify project path
    const { projectPath } = await inquirer.prompt([
      {
        type: "input",
        name: "projectPath",
        message: "Enter React Native project path:",
        default: currentDir,
        validate: async (input) => {
          const resolvedPath = path.resolve(input);
          if (!(await fs.pathExists(resolvedPath))) {
            return "Path does not exist";
          }
          if (!(await this.isReactNativeProject(resolvedPath))) {
            return "This is not a React Native project (missing package.json with react-native dependency)";
          }
          return true;
        },
      },
    ]);

    return path.resolve(projectPath);
  }

  /**
   * Check if directory is a React Native project
   */
  private static async isReactNativeProject(
    projectPath: string
  ): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      if (!(await fs.pathExists(packageJsonPath))) {
        return false;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return !!(
        dependencies["react-native"] ||
        dependencies["@react-native-community/cli"]
      );
    } catch {
      return false;
    }
  }

  /**
   * Show build summary before execution
   */
  static async confirmBuildConfig(config: BuildConfig): Promise<boolean> {
    console.log("\n📋 Build Configuration:");
    console.log(`   Platforms: ${config.platforms.join(", ")}`);
    console.log(`   Version: ${config.version}`);
    console.log(`   Project: ${config.projectPath}`);
    console.log(`   Output: ${config.outputPath}`);
    console.log(`   Bundle: ${config.bundleName || "index"}`);
    console.log(`   Source maps: ${config.sourcemap ? "Yes" : "No"}`);
    console.log(`   Minify: ${config.minify ? "Yes" : "No"}`);

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Proceed with this configuration?",
        default: true,
      },
    ]);

    return confirm;
  }

  /**
   * Prompt for platform selection (for advanced commands)
   */
  static async selectPlatforms(): Promise<("ios" | "android")[]> {
    const { platforms } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "platforms",
        message: "Select platforms:",
        choices: [
          { name: "iOS", value: "ios" },
          { name: "Android", value: "android" },
        ],
        default: ["ios", "android"],
        validate: (input) => {
          if (input.length === 0) {
            return "Please select at least one platform";
          }
          return true;
        },
      },
    ]);

    return platforms;
  }
}
