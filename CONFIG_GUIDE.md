# 📄 Configuration File Guide

## Overview
Nitro Hot Update CLI supports configuration files to streamline the build process. Instead of answering interactive prompts, you can define all settings in a `hotupdate.config.json` file.

## Benefits
- **Consistent Builds**: Same configuration every time
- **CI/CD Friendly**: No interactive prompts required
- **Version Control**: Configuration can be committed to git
- **Team Collaboration**: Share configurations across team members
- **Automation**: Perfect for automated builds and deployments

## Commands

### Generate Example Config
```bash
# Generate default config file
node dist/index.js config init

# Generate with custom path
node dist/index.js config init --output my-config.json

# Overwrite existing file
node dist/index.js config init --force
```

### Validate Configuration
```bash
# Validate default config file
node dist/index.js config validate

# Validate custom config file
node dist/index.js config validate --config my-config.json
```

### Build from Configuration
```bash
# Build using default hotupdate.config.json
node dist/index.js build-config

# Build using custom config file
node dist/index.js build-config --config my-config.json

# Dry run (validate only, no build)
node dist/index.js build-config --dry-run
```

## Configuration Schema

### Complete Example
```json
{
  "project": {
    "path": "./",
    "entryFile": "index.js"
  },
  "build": {
    "platforms": ["ios", "android"],
    "version": "1.0.0",
    "outputPath": "./hotupdate-build",
    "bundleName": "index",
    "sourcemap": false,
    "minify": true
  },
  "signature": {
    "enabled": true,
    "algorithm": "RSA-SHA256",
    "privateKeyPath": "./keys/hotupdate_private.pem",
    "publicKeyPath": "./keys/hotupdate_public.pem",
    "autoGenerate": true
  },
  "metadata": {
    "description": "Hot update configuration for MyApp",
    "author": "Your Name",
    "homepage": "https://github.com/yourusername/yourapp"
  }
}
```

### Project Settings
```json
{
  "project": {
    "path": "./",              // Path to React Native project (required)
    "entryFile": "index.js"    // Entry file name (optional)
  }
}
```

### Build Settings
```json
{
  "build": {
    "platforms": ["ios", "android"],     // Target platforms (required)
    "version": "1.0.0",                  // Version number (optional, uses package.json if not set)
    "outputPath": "./hotupdate-build",   // Output directory (required)
    "bundleName": "index",               // Bundle file name (optional, default: "index")
    "sourcemap": false,                  // Generate source maps (optional, default: false)
    "minify": true                       // Minify bundle (optional, default: true)
  }
}
```

### Signature Settings
```json
{
  "signature": {
    "enabled": true,                                  // Enable digital signature (required)
    "algorithm": "RSA-SHA256",                       // Signature algorithm (optional, default: "RSA-SHA256")
    "privateKeyPath": "./keys/hotupdate_private.pem", // Private key path (optional if autoGenerate=true)
    "publicKeyPath": "./keys/hotupdate_public.pem",   // Public key path (optional)
    "autoGenerate": true                             // Auto-generate keys if not found (optional, default: true)
  }
}
```

**Note**: If `signature.enabled` is `false`, no signature fields will be added to the manifest.

### Metadata (Optional)
```json
{
  "metadata": {
    "description": "Hot update configuration for MyApp",
    "author": "Your Name",
    "homepage": "https://github.com/yourusername/yourapp"
  }
}
```

## Configuration Examples

### Simple Configuration (No Signature)
```json
{
  "project": {
    "path": "/path/to/my-react-native-app"
  },
  "build": {
    "platforms": ["android"],
    "outputPath": "./build"
  },
  "signature": {
    "enabled": false
  }
}
```

### Production Configuration (With Signature)
```json
{
  "project": {
    "path": "/path/to/production-app"
  },
  "build": {
    "platforms": ["ios", "android"],
    "version": "2.1.0",
    "outputPath": "./production-builds",
    "minify": true,
    "sourcemap": false
  },
  "signature": {
    "enabled": true,
    "algorithm": "RSA-SHA256",
    "privateKeyPath": "/secure/keys/prod_private.pem",
    "autoGenerate": false
  },
  "metadata": {
    "description": "Production hot update build",
    "author": "Production Team",
    "homepage": "https://mycompany.com/app"
  }
}
```

### Development Configuration
```json
{
  "project": {
    "path": "./"
  },
  "build": {
    "platforms": ["android"],
    "outputPath": "./dev-builds",
    "minify": false,
    "sourcemap": true
  },
  "signature": {
    "enabled": true,
    "autoGenerate": true
  },
  "metadata": {
    "description": "Development build with debugging enabled"
  }
}
```

## Workflow Examples

### Local Development
```bash
# 1. Generate config for your project
node dist/index.js config init

# 2. Edit config file to match your needs
# Edit hotupdate.config.json

# 3. Validate configuration
node dist/index.js config validate

# 4. Build from config
node dist/index.js build-config
```

### CI/CD Pipeline
```yaml
# GitHub Actions example
name: Build Hot Update
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Validate hot update config
        run: node dist/index.js config validate --config .github/hotupdate.prod.config.json
        
      - name: Build hot update packages
        run: node dist/index.js build-config --config .github/hotupdate.prod.config.json
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: hotupdate-packages
          path: ./production-builds/*.zip
```

### Multiple Environment Configs
```bash
# Different configs for different environments
hotupdate.dev.config.json      # Development
hotupdate.staging.config.json  # Staging  
hotupdate.prod.config.json     # Production

# Build commands
node dist/index.js build-config --config hotupdate.dev.config.json
node dist/index.js build-config --config hotupdate.staging.config.json
node dist/index.js build-config --config hotupdate.prod.config.json
```

## Configuration Validation

The CLI automatically validates:
- ✅ Project path exists and is a React Native project
- ✅ Platform names are valid (ios/android)
- ✅ Version format follows semantic versioning
- ✅ Signature algorithm is supported
- ✅ Private key exists (if autoGenerate=false)
- ✅ Required fields are present

## Migration from Interactive Mode

### From Interactive to Config
1. Run interactive build once: `node dist/index.js build`
2. Note down all the settings you chose
3. Generate config: `node dist/index.js config init`
4. Edit config file with your preferred settings
5. Test with: `node dist/index.js build-config --dry-run`
6. Build with: `node dist/index.js build-config`

### Config vs Interactive vs CI Commands

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| **Interactive** (`build`) | One-time builds, exploration | Easy to use, guided prompts | Not reproducible, manual input |
| **Config** (`build-config`) | Regular builds, team projects | Reproducible, version controllable | Setup required |
| **CI** (`build-ci`) | Automated pipelines | Fast, scriptable | Limited flexibility |

## Best Practices

### Configuration Management
- **Version Control**: Commit config files to git
- **Environment Specific**: Use different configs for dev/staging/prod
- **Documentation**: Comment your config choices in README
- **Validation**: Always run `--dry-run` before actual builds

### Security
- **Private Keys**: Never commit private keys to version control
- **Paths**: Use relative paths for portability
- **Secrets**: Use environment variables or CI secrets for sensitive data

### Team Collaboration
- **Shared Configs**: Provide template configs for team members
- **Documentation**: Document config customization in README
- **Standardization**: Use consistent naming and structure

## Troubleshooting

### Common Issues

**"Configuration file not found"**
```bash
# Generate config file first
node dist/index.js config init
```

**"Project path does not exist"**
```json
{
  "project": {
    "path": "/correct/absolute/path/to/project"
  }
}
```

**"Not a React Native project"**
- Ensure `package.json` exists with `react-native` dependency
- Check project path is correct

**"Invalid version format"**
```json
{
  "build": {
    "version": "1.0.0"  // Use semantic versioning
  }
}
```

**"Private key not found"**
```json
{
  "signature": {
    "enabled": true,
    "autoGenerate": true  // Let CLI generate keys automatically
  }
}
```

## Summary

Configuration files provide a powerful way to standardize and automate hot update builds. They're especially useful for:

- 🔄 **Consistent builds** across environments
- 🤖 **CI/CD automation** without manual input  
- 👥 **Team collaboration** with shared configs
- 📝 **Documentation** of build settings
- 🔧 **Complex configurations** with many options

Start with `node dist/index.js config init` and customize the generated file to match your project needs!