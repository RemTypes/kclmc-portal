import { redirect } from 'next/navigation';

export default function RegisterRedirectPage() {
  redirect('/login?view=sign_up');
}
