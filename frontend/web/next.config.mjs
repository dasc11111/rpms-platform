/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Asegura que el worker de pdfjs-dist (usado para extraer texto de PDF en
  // Documentos > Busqueda de texto completo, Seccion 37 del Prompt Maestro
  // Medicina Nuclear) se incluya en el bundle de la funcion serverless. Sin
  // esto, pdfjs-dist falla en tiempo de ejecucion al no encontrar su propio
  // modulo de worker dentro del bundle de Next.js.
  experimental: {
    outputFileTracingIncludes: {
      "/api/documents/fulltext-search": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://api.rpms.app; frame-ancestors 'none';",
          },
        ],
      },
      {
        source: "/api/documents/:id/download",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
