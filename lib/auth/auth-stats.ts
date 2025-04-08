// Simple in-memory counter for tracking auth requests
let authRequestCount = 0;

// Function to increment the counter
export function incrementAuthRequestCount(): number {
  return ++authRequestCount;
}

// Function to get the current count
export function getAuthRequestCount(): number {
  return authRequestCount;
}

// Reset counter (for testing purposes)
export function resetAuthRequestCount(): void {
  authRequestCount = 0;
} 