import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('entries')
      .insert([
        {
          entry_name: body.entryName,
          email: body.email,
          selections: body.selections,
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Error creating entry' }, { status: 500 });
  }
} 