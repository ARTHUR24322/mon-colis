import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminSession';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin || admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Accès réservé au Super Admin' }, { status: 403 });
    }

    let resendKey = process.env.RESEND_API_KEY || '';
    if (!resendKey) {
      try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const match = envContent.match(/^RESEND_API_KEY=["']?(.*?)["']?$/m);
          if (match) {
            resendKey = match[1];
          }
        }
      } catch {}
    }

    return NextResponse.json({ 
      success: true, 
      key: resendKey ? `${resendKey.slice(0, 8)}...` : '',
      isConfigured: !!resendKey
    });
  } catch (error) {
    console.error('Erreur lecture config Resend:', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin || admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Accès réservé au Super Admin' }, { status: 403 });
    }

    const { resendApiKey } = await req.json();
    if (!resendApiKey) {
      return NextResponse.json({ success: false, error: 'Clé API requise' }, { status: 400 });
    }

    // En environnement serveur (production Vercel/Docker), recommander la variable d'environnement
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      let envContent = '';
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (envContent.match(/^RESEND_API_KEY=/m)) {
        envContent = envContent.replace(/^RESEND_API_KEY=.*$/m, `RESEND_API_KEY="${resendApiKey}"`);
      } else {
        envContent += `\nRESEND_API_KEY="${resendApiKey}"\n`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
    } catch (fsErr) {
      console.warn('Système de fichiers non inscriptible (normal en production Vercel/Serverless):', fsErr);
    }

    // Met à jour la variable en mémoire pour le processus actif
    process.env.RESEND_API_KEY = resendApiKey;

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration Resend mise à jour' 
    });
  } catch (error) {
    console.error('Erreur sauvegarde config Resend:', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

