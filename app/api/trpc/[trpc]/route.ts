// Simple handler that always returns a 404 response
// This is a placeholder to satisfy Next.js routing without actually implementing tRPC
const handler = () => {
  return new Response('tRPC API not available', { status: 404 });
};

export { handler as GET, handler as POST }; 