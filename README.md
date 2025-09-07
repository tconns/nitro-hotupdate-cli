# Nitro Hot Update CLI

CLI tool để build bundle JS và assets riêng biệt cho tính năng hot update trong React Native.

## 🚀 Tính năng chính

### ✨ Interactive Build Process
- **Platform Selection**: Chọn build cho iOS, Android hoặc cả hai
- **Version Management**: Tự động lấy version từ package.json hoặc tùy chỉnh
- **Smart Configuration**: Hỏi người dùng để cấu hình build phù hợp
- **Zero Config**: Không cần tạo file config, mọi thứ được hỏi qua prompts

### 📱 Platform Support
- **iOS**: Tạo bundle main.jsbundle với assets
- **Android**: Tạo bundle index.android.bundle với assets
- **Cross-platform**: Support cả hai platform cùng lúc

### 📦 Bundle Features
- **JS Bundling**: Sử dụng Metro bundler của React Native
- **Asset Handling**: Tự động copy và quản lý assets
- **Source Maps**: Tùy chọn tạo source maps cho debugging
- **Minification**: Tùy chọn minify bundle để giảm size
- **ZIP Packaging**: Tự động tạo file ZIP cho từng platform

## 📋 Cách sử dụng

### Quick Start

```bash
# Cài đặt CLI
npm install -g nitro-hotupdate-cli

# Chạy trong thư mục React Native project
nitro-hotupdate build

# Hoặc specify project path
nitro-hotupdate build --project-path /path/to/your/rn-project
```

### Interactive Build Process

Khi chạy `nitro-hotupdate build`, CLI sẽ hỏi bạn:

1. **Platforms**: Chọn iOS, Android hoặc cả hai
2. **Version**: 
   - Sử dụng version hiện tại từ package.json
   - Bump patch/minor/major version
   - Nhập version tùy chỉnh
3. **Bundle Name**: Tên bundle (mặc định: index)
4. **Output Directory**: Thư mục output (mặc định: ./hotupdate-build)
5. **Source Maps**: Có tạo source maps không
6. **Minification**: Có minify bundle không

### Commands

#### Main Commands

```bash
# Interactive build
nitro-hotupdate build

# Build với minimal prompts (cho CI/CD)
nitro-hotupdate build-ci --project-path ./my-app --platforms ios,android --version 1.2.3

# Tạo project structure mẫu
nitro-hotupdate init

# Hiển thị thông tin project
nitro-hotupdate info
```

#### Advanced Commands

```bash
# Build cho platforms cụ thể với full prompts
nitro-hotupdate advanced build-platform

# Validate bundles đã tạo
nitro-hotupdate advanced validate

# So sánh size bundles
nitro-hotupdate advanced compare

# Dọn dẹp build artifacts
nitro-hotupdate advanced clean
```

## 🛠️ Configuration

### Auto-detection
CLI tự động detect:
- React Native project (kiểm tra package.json)
- Entry file (index.js, index.ts, index.jsx, index.tsx)
- Current version từ package.json

### Build Process
1. **Bundle Generation**: Sử dụng `react-native bundle` command
2. **Asset Copying**: Copy assets từ project vào build directory
3. **Manifest Creation**: Tạo manifest.json chứa metadata
4. **ZIP Creation**: Đóng gói thành file ZIP cho deployment

## 📁 Output Structure

```
hotupdate-build/
├── ios/
│   ├── bundles/
│   │   ├── index.ios.bundle
│   │   └── index.ios.map (nếu có sourcemap)
│   ├── assets/
│   │   └── [asset files]
│   └── manifest.json
├── android/
│   ├── bundles/
│   │   ├── index.android.bundle
│   │   └── index.android.map (nếu có sourcemap)
│   ├── assets/
│   │   └── [asset files]
│   └── manifest.json
└── ios-v1.0.0-hotupdate.zip
└── android-v1.0.0-hotupdate.zip
```

## � Manifest Format

```json
{
  "version": "1.0.0",
  "platform": "ios",
  "bundleUrl": "bundles/index.ios.bundle",
  "bundleSize": 1234567,
  "bundleHash": "abc123",
  "assets": [
    {
      "name": "logo.png",
      "type": "png",
      "url": "assets/logo.png",
      "hash": "def456"
    }
  ],
  "timestamp": 1640995200000,
  "minAppVersion": "1.0.0",
  "metadata": {
    "buildTime": "2023-01-01T00:00:00.000Z",
    "builder": "nitro-hotupdate-cli",
    "sourcemap": true,
    "minified": true
  }
}
```

## 🔧 Integration với App

### 1. Upload bundles lên server/CDN

```bash
# Example với AWS S3
aws s3 cp hotupdate-build/ios/ s3://your-bucket/bundles/ios/1.0.0/ --recursive
aws s3 cp hotupdate-build/android/ s3://your-bucket/bundles/android/1.0.0/ --recursive
```

### 2. Implement hot update logic trong app

```javascript
import { Platform } from 'react-native';

const baseUrl = 'https://your-cdn.com/bundles';
const currentVersion = '1.0.0';

async function checkForUpdates() {
  const platform = Platform.OS;
  const manifestUrl = `${baseUrl}/${platform}/${currentVersion}/manifest.json`;
  
  try {
    const response = await fetch(manifestUrl);
    const manifest = await response.json();
    
    if (manifest.version !== getCurrentAppVersion()) {
      const bundleUrl = `${baseUrl}/${platform}/${manifest.version}/${manifest.bundleUrl}`;
      await downloadAndApplyUpdate(bundleUrl, manifest);
    }
  } catch (error) {
    console.error('Hot update check failed:', error);
  }
}
```

**Made with ❤️ for React Native developers**

CLI này giúp bạn tạo hot update bundles một cách dễ dàng và interactive, không cần phải nhớ các config phức tạp hay command dài.