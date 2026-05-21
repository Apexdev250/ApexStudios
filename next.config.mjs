/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['studio', 'ai-agent', 'workflow-builder'],
  // Performance optimizations
  reactStrictMode: true,
  // Remove console.log in production
  compiler: {
    removeConsole: process.env.NODE_ENV !== 'development',
  },
  // Optimize images
  images: {
    domains: ['api.muapi.ai'],
    deviceSizes: [640, 768, 1024, 1280, 1600, 2048],
    formats: ['image/avif', 'image/webp'],
  },
  // Reduce build time and improve caching
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Split chunks for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          // Split large libraries into separate chunks
          studio: {
            test: /[\\/]node_modules[\\/]studio/,
            name: 'studio',
            chunks: 'all',
          },
          ai: {
            test: /[\\/]node_modules[\\/](ai-agent|reactflow|@xyflow\/react)[\\/]/,
            name: 'ai-libs',
            chunks: 'all',
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      };
      
      // Minimize CSS
      config.optimization.minimize = true;
    }
    
    // Ignore electron modules in web builds
    if (!isServer) {
      config.externals = [...(config.externals || []), 'electron'];
    }
    
    return config;
  },
  // Enable compression
  compress: true,
  // Generate etags
  generateEtags: true,

  // Fix workspace root detection - multiple lockfiles exist in parent dir
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
