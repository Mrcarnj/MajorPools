'use client';

import { useAuth } from '@/lib/auth-context';

export default function ExampleComponent() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Welcome, {user?.name}!</p>
          {/* Protected content */}
        </div>
      ) : (
        <div>
          <p>Please log in</p>
          {/* Public content */}
        </div>
      )}
    </div>
  );
} 