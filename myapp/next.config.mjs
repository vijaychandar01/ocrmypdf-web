/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverActions: {
        allowedOrigins: [
          'localhost:3000',
          'automatic-capybara-wr9p9p7w75jxcvg5x-3000.app.github.dev', // Include this as well if needed
        ],
      },
    },
  };
  
  export default nextConfig;
  