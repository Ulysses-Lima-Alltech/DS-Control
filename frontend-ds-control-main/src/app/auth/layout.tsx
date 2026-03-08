import { AuthGuard } from '@/guards/auth.guard';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
