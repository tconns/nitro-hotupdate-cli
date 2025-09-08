import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as path from "path";

export interface SignatureConfig {
  algorithm: "RSA-SHA256" | "ECDSA-SHA256";
  privateKeyPath?: string;
  publicKeyPath?: string;
  keySize?: number; // For RSA: 2048, 3072, 4096. For ECDSA: 256, 384, 521
}

export interface SignatureResult {
  signature: string;
  algorithm: string;
  publicKey: string;
  timestamp: number;
}

export interface VerificationResult {
  isValid: boolean;
  error?: string;
  algorithm?: string;
  timestamp?: number;
}

export class DigitalSignature {
  private config: SignatureConfig;

  constructor(
    config: SignatureConfig = { algorithm: "RSA-SHA256", keySize: 2048 }
  ) {
    this.config = {
      keySize: 2048,
      ...config,
    };
  }

  /**
   * Generate RSA key pair
   */
  async generateRSAKeyPair(
    keySize: number = 2048
  ): Promise<{ privateKey: string; publicKey: string }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        "rsa",
        {
          modulusLength: keySize,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err);
          } else {
            resolve({ privateKey, publicKey });
          }
        }
      );
    });
  }

  /**
   * Generate ECDSA key pair
   */
  async generateECDSAKeyPair(
    namedCurve: string = "prime256v1"
  ): Promise<{ privateKey: string; publicKey: string }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        "ec",
        {
          namedCurve, // prime256v1, secp384r1, secp521r1
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err);
          } else {
            resolve({ privateKey, publicKey });
          }
        }
      );
    });
  }

  /**
   * Sign data with private key
   */
  async signData(data: string, privateKey: string): Promise<SignatureResult> {
    try {
      const algorithm = this.config.algorithm;
      const hashAlgorithm = algorithm.split("-")[1]; // SHA256

      let signature: string;

      if (algorithm.startsWith("RSA")) {
        const sign = crypto.createSign(hashAlgorithm);
        sign.update(data);
        const signatureBuffer = sign.sign(privateKey);
        signature = signatureBuffer.toString("base64");
      } else if (algorithm.startsWith("ECDSA")) {
        const sign = crypto.createSign(hashAlgorithm);
        sign.update(data);
        const signatureBuffer = sign.sign(privateKey);
        signature = signatureBuffer.toString("base64");
      } else {
        throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      // Extract public key from private key
      const keyObject = crypto.createPrivateKey(privateKey);
      const publicKey = crypto.createPublicKey(keyObject).export({
        type: "spki",
        format: "pem",
      }) as string;

      return {
        signature: `${algorithm}:${signature}`,
        algorithm,
        publicKey,
        timestamp: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to sign data: ${message}`);
    }
  }

  /**
   * Verify signature with public key
   */
  async verifySignature(
    data: string,
    signatureWithAlgorithm: string,
    publicKey: string
  ): Promise<VerificationResult> {
    try {
      // Parse signature format: "RSA-SHA256:base64signature"
      const [algorithm, signature] = signatureWithAlgorithm.split(":", 2);

      if (!algorithm || !signature) {
        return {
          isValid: false,
          error: "Invalid signature format. Expected 'ALGORITHM:SIGNATURE'",
        };
      }

      const hashAlgorithm = algorithm.split("-")[1]; // SHA256
      const signatureBuffer = Buffer.from(signature, "base64");

      const verify = crypto.createVerify(hashAlgorithm);
      verify.update(data);

      const isValid = verify.verify(publicKey, signatureBuffer);

      return {
        isValid,
        algorithm,
        timestamp: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        error: `Verification failed: ${message}`,
      };
    }
  }

  /**
   * Sign manifest.json file
   */
  async signManifest(
    manifestPath: string,
    privateKeyPath: string
  ): Promise<SignatureResult> {
    try {
      // Read manifest and private key
      const manifestContent = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(manifestContent);

      // Remove existing signature if present
      delete manifest.signature;
      delete manifest.publicKey;
      delete manifest.signatureTimestamp;

      // Create canonical JSON string for signing
      const canonicalManifest = JSON.stringify(
        manifest,
        Object.keys(manifest).sort()
      );

      // Read private key
      const privateKey = await fs.readFile(privateKeyPath, "utf8");

      // Sign the canonical manifest
      const signatureResult = await this.signData(
        canonicalManifest,
        privateKey
      );

      // Add signature to manifest
      manifest.signature = signatureResult.signature;
      manifest.publicKey = signatureResult.publicKey;
      manifest.signatureTimestamp = signatureResult.timestamp;

      // Write back to file
      await fs.writeJSON(manifestPath, manifest, { spaces: 2 });

      console.log(`🔐 Manifest signed with ${signatureResult.algorithm}`);
      console.log(
        `📝 Signature: ${signatureResult.signature.substring(0, 50)}...`
      );

      return signatureResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to sign manifest: ${message}`);
    }
  }

  /**
   * Verify manifest.json signature
   */
  async verifyManifest(
    manifestPath: string,
    publicKeyPath?: string
  ): Promise<VerificationResult> {
    try {
      const manifestContent = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(manifestContent);

      if (!manifest.signature) {
        return {
          isValid: false,
          error: "No signature found in manifest",
        };
      }

      // Get public key (from manifest or external file)
      let publicKey: string;
      if (publicKeyPath) {
        publicKey = await fs.readFile(publicKeyPath, "utf8");
      } else if (manifest.publicKey) {
        publicKey = manifest.publicKey;
      } else {
        return {
          isValid: false,
          error: "No public key available for verification",
        };
      }

      // Remove signature fields for verification
      const signature = manifest.signature;
      const signatureTimestamp = manifest.signatureTimestamp;
      delete manifest.signature;
      delete manifest.publicKey;
      delete manifest.signatureTimestamp;

      // Create canonical JSON string
      const canonicalManifest = JSON.stringify(
        manifest,
        Object.keys(manifest).sort()
      );

      // Verify signature
      const result = await this.verifySignature(
        canonicalManifest,
        signature,
        publicKey
      );

      return {
        ...result,
        timestamp: signatureTimestamp,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        error: `Verification failed: ${message}`,
      };
    }
  }

  /**
   * Generate and save key pair to files
   */
  async generateAndSaveKeyPair(
    outputDir: string,
    keyName: string = "hotupdate"
  ): Promise<{ privateKeyPath: string; publicKeyPath: string }> {
    await fs.ensureDir(outputDir);

    let keyPair: { privateKey: string; publicKey: string };

    if (this.config.algorithm === "RSA-SHA256") {
      keyPair = await this.generateRSAKeyPair(this.config.keySize);
    } else if (this.config.algorithm === "ECDSA-SHA256") {
      const namedCurve =
        this.config.keySize === 256
          ? "prime256v1"
          : this.config.keySize === 384
          ? "secp384r1"
          : "secp521r1";
      keyPair = await this.generateECDSAKeyPair(namedCurve);
    } else {
      throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
    }

    const privateKeyPath = path.join(outputDir, `${keyName}_private.pem`);
    const publicKeyPath = path.join(outputDir, `${keyName}_public.pem`);

    await fs.writeFile(privateKeyPath, keyPair.privateKey);
    await fs.writeFile(publicKeyPath, keyPair.publicKey);

    console.log(`🔑 Generated ${this.config.algorithm} key pair:`);
    console.log(`   Private key: ${privateKeyPath}`);
    console.log(`   Public key: ${publicKeyPath}`);

    return { privateKeyPath, publicKeyPath };
  }
}
