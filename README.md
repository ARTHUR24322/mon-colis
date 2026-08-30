# 📦 Moncolis

**Moncolis** est une plateforme web de gestion de livraison de colis qui connecte les vendeurs aux agences de livraison et à leurs livreurs.

## ✨ Fonctionnalités

- **Espace Vendeur** : Créer et gérer des colis, générer un code de validation, suivre le statut en temps réel
- **Espace Agence** : Accepter/refuser des colis, assigner des livreurs, gérer les livraisons
- **Espace Livreur** : Voir les colis assignés, valider la livraison avec le code client
- **Suivi public** : Les clients suivent leur colis via un lien de tracking unique
- **Espace Admin** : Gestion globale de la plateforme (URL sécurisée)

## 🛠️ Stack Technique

| Couche         | Technologie                     |
|----------------|---------------------------------|
| Framework      | Next.js 16 (App Router)         |
| Langage        | TypeScript                      |
| Base de données| PostgreSQL (via Supabase)        |
| ORM            | Prisma v7                       |
| Auth           | Supabase Auth                   |
| Style          | CSS global (Vanilla CSS)        |

## 🚀 Installation locale

### Prérequis
- Node.js 18+
- Un projet Supabase avec les tables créées (`schema.sql`)

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/<ton-username>/mon-colis.git
cd mon-colis

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.local.example .env.local
# Remplir les valeurs dans .env.local

# 4. Générer le client Prisma
npx prisma generate

# 5. Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## 🔐 Variables d'environnement

Créer un fichier `.env.local` avec les variables suivantes :

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
DATABASE_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres
```

> ⚠️ Ne jamais committer le fichier `.env.local` — il est déjà ignoré par `.gitignore`.

## 🗄️ Base de données

Le fichier [`schema.sql`](./schema.sql) contient toutes les instructions SQL pour initialiser la base de données Supabase.

Le schéma Prisma est dans [`prisma/schema.prisma`](./prisma/schema.prisma).

## 📁 Structure du projet

```
src/
├── app/
│   ├── admin-x9k2/       # Interface administrateur (URL sécurisée)
│   ├── auth/[role]/      # Pages login/register (vendeur, agence)
│   ├── dashboard/        # Dashboards vendeur et agence
│   ├── livreur/          # Interface livreur
│   ├── track/            # Suivi public d'un colis
│   └── page.tsx          # Page d'accueil
├── lib/
│   └── prisma.ts         # Client Prisma singleton
└── utils/
    └── supabase/         # Helpers Supabase Auth
```

## 📜 Licence

Projet privé — tous droits réservés.
