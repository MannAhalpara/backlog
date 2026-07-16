import { getSessionUser } from '@/lib/auth';
import NavbarClient from './NavbarClient';

export default async function Navbar() {
  const user = await getSessionUser();

  return <NavbarClient user={user} />;
}
