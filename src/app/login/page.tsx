import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';
import { Logo } from '@/components/logo';
import { Footer } from '@/components/footer';

export default async function LoginPage() {
  const user = await getAuthUser();
  if (user) {
    redirect('/app');
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-between bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="w-full flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-6 z-10">
          <Logo />
        </div>
        <div className="w-full max-w-md flex flex-col justify-center">
          <LoginForm />
        </div>
      </div>
      <div className="w-full z-10 glass-panel">
        <Footer />
      </div>
    </main>
  );
}
