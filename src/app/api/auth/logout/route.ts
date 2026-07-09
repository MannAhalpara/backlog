import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/auth';

export async function POST() {
  try {
    await deleteSession();
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await deleteSession();
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    
    // Redirect to login page
    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin;
    return NextResponse.redirect(new URL('/login', baseUrl));
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
