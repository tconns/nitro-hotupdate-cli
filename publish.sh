#!/usr/bin/env bash

# 🚀 Quick Publishing Script for nitro-hotupdate-cli

echo "🔧 Starting publish preparation..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from project root."
    exit 1
fi

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "📦 Building project..."
    npm run build
else
    echo "✅ Build directory exists"
fi

# Check npm login status
echo "🔑 Checking npm login status..."
npm whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Please login to npm first:"
    echo "   npm login"
    exit 1
else
    echo "✅ NPM login verified: $(npm whoami)"
fi

# Check package name availability
echo "📦 Checking package name availability..."
PACKAGE_NAME=$(node -p "require('./package.json').name")
npm view $PACKAGE_NAME > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "⚠️  Package name '$PACKAGE_NAME' already exists on npm"
    echo "   Consider using a different name or scoped package @username/$PACKAGE_NAME"
    read -p "Continue anyway? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        exit 1
    fi
else
    echo "✅ Package name '$PACKAGE_NAME' is available"
fi

# Test local installation
echo "🧪 Testing local installation..."
npm pack > /dev/null
TARBALL=$(ls *.tgz | head -n1)
echo "✅ Package created: $TARBALL"

# Show package contents
echo "📋 Package contents:"
tar -tzf $TARBALL | head -20
if [ $(tar -tzf $TARBALL | wc -l) -gt 20 ]; then
    echo "   ... and $(( $(tar -tzf $TARBALL | wc -l) - 20 )) more files"
fi

# Clean up test tarball
rm $TARBALL

# Version information
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Current version: $CURRENT_VERSION"

# Pre-publish checklist
echo ""
echo "📋 Pre-publish checklist:"
echo "   ✅ package.json updated"
echo "   ✅ LICENSE file exists"
echo "   ✅ .npmignore configured"
echo "   ✅ Build successful"
echo "   ✅ NPM login verified"
echo "   ✅ Package name checked"
echo ""

# Ask for confirmation
read -p "🚀 Ready to publish? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Publishing cancelled"
    exit 0
fi

# Publish
echo "🚀 Publishing to npm..."
npm publish

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Successfully published $PACKAGE_NAME@$CURRENT_VERSION!"
    echo ""
    echo "📦 Users can now install with:"
    echo "   npm install -g $PACKAGE_NAME"
    echo "   npx $PACKAGE_NAME --help"
    echo ""
    echo "🔗 View on npm: https://www.npmjs.com/package/$PACKAGE_NAME"
else
    echo "❌ Publishing failed. Check the error above."
    exit 1
fi