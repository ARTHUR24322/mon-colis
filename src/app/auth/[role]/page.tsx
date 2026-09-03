import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ role: string }>;
}

export default async function AuthRoleIndexPage({ params }: Props) {
  const { role } = await params;
  if (role === 'agence') {
    redirect('/auth/agence/login');
  } else {
    redirect('/auth/vendeur/login');
  }
}
