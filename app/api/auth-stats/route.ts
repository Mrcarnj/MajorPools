import { NextResponse } from 'next/server';
import { getAuthRequestCount } from '@/lib/auth/auth-stats';

export async function GET() {
  // Get the current count
  const count = getAuthRequestCount();
  
  return NextResponse.json({ 
    count,
    timestamp: new Date().toISOString()
  });
} 