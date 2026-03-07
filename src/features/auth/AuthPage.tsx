import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Loader2 } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const codeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type CodeFormValues = z.infer<typeof codeSchema>;

export default function AuthPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors },
  } = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
  });

  const onEmailSubmit = async (data: EmailFormValues) => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await authApi.login(data.email);
      } else {
        await authApi.register(data.email);
      }
      setEmail(data.email);
      setStep('code');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const onCodeSubmit = async (data: CodeFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.verify(email, data.code);
      const { access_token, refresh_token } = response.data.data;
      setTokens(access_token, refresh_token);
      navigate('/chat');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {step === 'email'
              ? mode === 'login'
                ? 'Login'
                : 'Create an account'
              : 'Verify Code'}
          </CardTitle>
          <CardDescription>
            {step === 'email'
              ? 'Enter your email to continue'
              : `Enter the code sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSubmitEmail(onEmailSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...registerEmail('email')}
                />
                {emailErrors.email && (
                  <p className="text-sm text-destructive">
                    {emailErrors.email.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'Send Login Code' : 'Send Registration Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmitCode(onCodeSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  {...registerCode('code')}
                />
                {codeErrors.code && (
                  <p className="text-sm text-destructive">
                    {codeErrors.code.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep('email')}
                disabled={loading}
              >
                Back to Email
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {step === 'email' && (
            <Button
              variant="link"
              onClick={() =>
                setMode(mode === 'login' ? 'register' : 'login')
              }
            >
              {mode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Login'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
