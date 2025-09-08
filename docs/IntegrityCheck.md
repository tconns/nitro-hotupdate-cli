# Bundle Integrity Check với SHA256

## Tổng quan
Module `BundleBuilder` đã được nâng cấp để hỗ trợ integrity check sử dụng SHA256 hash. Điều này đảm bảo rằng các file bundle và assets tải về không bị thay đổi hoặc hỏng trong quá trình truyền tải.

## Cách hoạt động

### 1. Tạo SHA256 Hash
Khi build bundle và assets, module sẽ tự động tính toán SHA256 hash cho:
- Bundle JavaScript file
- Tất cả asset files (images, fonts, etc.)

### 2. Định dạng Manifest
Manifest sẽ có thêm các trường mới:

```json
{
  "platform": "android",
  "bundleUrl": "bundles/index.android.bundle",
  "bundleSize": 1234567,
  "bundleHash": "1694123456789",
  "bundleSHA256": "sha256:9f2c4a5b8d1e3f7a2c9b6e4d8a1c5f9e3b7a6d2c8e1f4a9b5d8c2e6f1a4b7c9e",
  "assets": [
    {
      "name": "logo.png",
      "type": "png",
      "httpServerLocation": "assets/images/logo.png",
      "scales": [1],
      "hash": "1694123456789",
      "sha256": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890"
    }
  ],
  "timestamp": 1694123456789,
  "version": "1.0.0"
}
```

## Implementation phía Client

### Android (Kotlin)
```kotlin
fun calculateSHA256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { fis ->
        val buffer = ByteArray(1024)
        var read: Int
        while (fis.read(buffer).also { read = it } != -1) {
            digest.update(buffer, 0, read)
        }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}

fun verifyBundleIntegrity(bundleFile: File, expectedHash: String): Boolean {
    val calculatedHash = calculateSHA256(bundleFile)
    val cleanExpectedHash = if (expectedHash.startsWith("sha256:")) {
        expectedHash.substring(7)
    } else {
        expectedHash
    }
    return calculatedHash == cleanExpectedHash
}

// Sử dụng
val bundleFile = File("/path/to/downloaded/bundle.js")
val manifest = loadManifest() // Load manifest từ server
if (verifyBundleIntegrity(bundleFile, manifest.bundleSHA256)) {
    // Bundle hợp lệ, có thể sử dụng
    applyHotUpdate(bundleFile)
} else {
    // Bundle bị hỏng hoặc thay đổi, từ chối update
    Log.error("Bundle integrity check failed!")
}
```

### iOS (Swift)
```swift
import CryptoKit

func sha256(url: URL) -> String {
    let data = try! Data(contentsOf: url)
    let hash = SHA256.hash(data: data)
    return hash.compactMap { String(format: "%02x", $0) }.joined() 
}

func verifyBundleIntegrity(bundleUrl: URL, expectedHash: String) -> Bool {
    let calculatedHash = sha256(url: bundleUrl)
    let cleanExpectedHash = expectedHash.hasPrefix("sha256:") 
        ? String(expectedHash.dropFirst(7))
        : expectedHash
    return calculatedHash == cleanExpectedHash
}

// Sử dụng
let bundleUrl = URL(fileURLWithPath: "/path/to/downloaded/bundle.js")
let manifest = loadManifest() // Load manifest từ server
if verifyBundleIntegrity(bundleUrl: bundleUrl, expectedHash: manifest.bundleSHA256) {
    // Bundle hợp lệ, có thể sử dụng
    applyHotUpdate(bundleUrl)
} else {
    // Bundle bị hỏng hoặc thay đổi, từ chối update
    print("Bundle integrity check failed!")
}
```

## API Methods

### `verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean>`
Verify tính toàn vẹn của một file sử dụng SHA256 hash.

**Parameters:**
- `filePath`: Đường dẫn đến file cần verify
- `expectedHash`: SHA256 hash mong đợi (có thể có prefix "sha256:" hoặc không)

**Returns:** `true` nếu hash khớp, `false` nếu không khớp

**Example:**
```typescript
const builder = new BundleBuilder("/path/to/project");
const isValid = await builder.verifyFileIntegrity(
  "/path/to/bundle.js", 
  "sha256:9f2c4a5b8d1e3f7a2c9b6e4d8a1c5f9e3b7a6d2c8e1f4a9b5d8c2e6f1a4b7c9e"
);
```

## Lưu ý về Security

1. **SHA256 vs SHA1/MD5:** SHA256 được khuyên dùng vì an toàn hơn SHA1 và MD5
2. **Backward Compatibility:** Module vẫn giữ lại hash cũ (`bundleHash` và `hash`) để tương thích ngược
3. **Network Security:** Nên sử dụng HTTPS khi tải manifest và bundle để tránh man-in-the-middle attacks
4. **Signature Verification:** Có thể kết hợp với digital signature để bảo mật cao hơn

## Best Practices

1. **Always verify:** Luôn verify hash trước khi apply hot update
2. **Fallback mechanism:** Có cơ chế fallback nếu integrity check fail
3. **Logging:** Log các trường hợp integrity check fail để debug
4. **Cache invalidation:** Xóa cache nếu integrity check fail