// AIrIA — Metro config (monorepo-aware)
// Resolves workspace packages from the pnpm monorepo root.

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all workspace packages
config.watchFolders = [workspaceRoot]

// Resolve modules from workspace root first, then project
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Map workspace package names to their source entry points.
config.resolver.extraNodeModules = {
  '@airia/types':   path.resolve(workspaceRoot, 'packages/airia-types/src/index.ts'),
  '@airia/service': path.resolve(workspaceRoot, 'packages/airia-service/src/index.ts'),
  '@airia/ui':      path.resolve(workspaceRoot, 'packages/airia-ui/src/index.ts'),
}

// @airia/db uses IndexedDB (web-only) — intercept before node_modules resolution
// so pnpm symlinks don't bypass extraNodeModules. rnDb is a file-backed
// implementation of the same API using expo-file-system.
const rnDb = path.resolve(projectRoot, 'src/db/rnDb.ts')
const uiRoot = path.resolve(workspaceRoot, 'packages/airia-ui/src')
// The pnpm store contains multiple react-native copies; if any module in the
// graph resolves a different copy than the app's, AppRegistry registers into
// the wrong instance and the bridge sees zero callable modules. Force every
// react / react-native import to resolve from the app package.
const FORCED_SINGLETONS = ['react', 'react-native', 'expo', 'expo-file-system']
// expo-* core packages aren't direct app deps; pin them to the app expo
// package's own dependency tree so only one copy ends up in the bundle.
const EXPO_CORE = ['expo-modules-core', 'expo-constants']
const expoOrigin = path.join(projectRoot, 'node_modules/expo/package.json')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = FORCED_SINGLETONS.find(
    p => moduleName === p || moduleName.startsWith(p + '/')
  )
  if (pkg && !moduleName.startsWith('react-native-')) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'index.js') },
      moduleName,
      platform
    )
  }
  const expoPkg = EXPO_CORE.find(
    p => moduleName === p || moduleName.startsWith(p + '/')
  )
  if (expoPkg) {
    return context.resolveRequest(
      { ...context, originModulePath: expoOrigin },
      moduleName,
      platform
    )
  }
  if (moduleName === '@airia/db') {
    return { filePath: rnDb, type: 'sourceFile' }
  }
  // Allow deep imports like @airia/ui/src/ThemeToken or @airia/ui/src/AiriaLogo
  if (moduleName.startsWith('@airia/ui/src/')) {
    const subpath = moduleName.replace('@airia/ui/src/', '')
    const tsxPath = path.resolve(uiRoot, subpath + '.tsx')
    const tsPath = path.resolve(uiRoot, subpath + '.ts')
    const fs = require('fs')
    return { filePath: fs.existsSync(tsxPath) ? tsxPath : tsPath, type: 'sourceFile' }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
