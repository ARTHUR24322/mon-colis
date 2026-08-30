import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moncolis - Plateforme de Livraison",
  description: "Connecte les vendeurs aux agences de livraison fiables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
