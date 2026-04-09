import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { startAuthentication } from '@simplewebauthn/browser';
import { authApi } from '@/api/endpoints';
import { TokenPair } from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { OtpInput } from '@/components/ui/OtpInput';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/shared/branding/brand';
import { Logo } from '@/shared/branding/Logo';
import { PwaInstallCard } from '@/shared/branding/PwaInstallCard';

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const AUTH_STEPS = [
  { id: 'email', label: 'Email' },
  { id: 'code', label: 'Code' },
] as const;

interface AuthNoticeProps {
  variant: 'error' | 'success' | 'warning';
  centered?: boolean;
  children: React.ReactNode;
}

function AuthNotice({ variant, centered = false, children }: AuthNoticeProps) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm',
        centered ? 'items-center justify-center text-center' : 'items-start',
        variant === 'error' && 'border-destructive/20 bg-destructive/10 text-destructive',
        variant === 'success' && 'border-border/70 bg-muted/35 text-foreground',
        variant === 'warning' && 'border-border/70 bg-accent/50 text-muted-foreground'
      )}
    >
      {children}
    </div>
  );
}

export default function AuthPage() {
  const setTokens = useAuthStore((state) => state.setTokens);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isIframe, setIsIframe] = useState(false);
  const lastSubmittedCodeRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    setIsIframe(window !== window.top);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step !== 'code') {
      lastSubmittedCodeRef.current = null;
      return;
    }

    if (code.length < 6) {
      lastSubmittedCodeRef.current = null;
      return;
    }

    if (loading || lastSubmittedCodeRef.current === code) {
      return;
    }

    lastSubmittedCodeRef.current = code;
    void onCodeSubmit();
  }, [code, step, loading]);

  const finalizeAuthSession = ({ access_token, refresh_token }: TokenPair) => {
    setTokens(access_token, refresh_token);
  };

  const onEmailSubmit = async ({ email: rawEmail }: EmailFormValues) => {
    setLoading(true);
    setError(null);
    setHint(null);

    try {
      const response = await authApi.start(rawEmail);
      setEmail(response.identifier);
      setValue('email', response.identifier);
      setHint(response.message);
      setStep('code');
      setCooldown(30);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'Failed to continue with email';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    const data = getValues();
    if (!data.email) {
      setError('Enter your email first to look for passkeys.');
      return;
    }

    setLoading(true);
    setError(null);
    setHint(null);

    try {
      const optionsPayload = (await authApi.passkeys.loginStart(data.email)) as Record<string, any>;
      const options = 'optionsJSON' in optionsPayload
        ? { ...optionsPayload }
        : { optionsJSON: optionsPayload };

      if (options.optionsJSON) {
        options.optionsJSON.userVerification = 'preferred';
      }

      const credential = await startAuthentication(options as Parameters<typeof startAuthentication>[0]);
      const tokenPair = await authApi.passkeys.loginFinish({ email: data.email, credential });
      finalizeAuthSession(tokenPair);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || err.message || 'Passkey login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onCodeSubmit = async () => {
    if (code.length !== 6 || !email) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tokenPair = await authApi.finish(email, code);
      finalizeAuthSession(tokenPair);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'Invalid verification code';
      setError(message);
      setCode('');
      lastSubmittedCodeRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || !email) {
      return;
    }

    setLoading(true);
    setError(null);
    setHint(null);

    try {
      const response = await authApi.start(email);
      setEmail(response.identifier);
      setHint(response.message);
      setCooldown(30);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'Failed to resend code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setHint(null);
    lastSubmittedCodeRef.current = null;
    setValue('email', email);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6 sm:px-6">
      <div className="absolute inset-x-0 top-[-10rem] h-80 bg-primary/8 blur-3xl" />
      <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-muted/80 blur-3xl" />
      <div className="absolute bottom-0 right-[-5rem] h-56 w-56 rounded-full bg-accent/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
          className="w-full space-y-4"
        >
          <Card className="overflow-hidden rounded-[30px] border border-border/70 bg-card/95 text-card-foreground shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur">
            <CardHeader className="space-y-5 border-b border-border/70 bg-background/70 px-6 pb-6 pt-7 sm:px-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28, ease: 'easeOut', delay: 0.1 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                <Logo variant="wordmark" size="lg" />
                <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground shadow-sm">
                  Secure sign in
                </div>
              </motion.div>

              <div className="flex gap-2">
                {AUTH_STEPS.map((item, index) => {
                  const isActive = step === item.id;
                  const isComplete = step === 'code' && index === 0;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex flex-1 items-center gap-3 rounded-full border px-3 py-2 text-sm transition-colors',
                        isActive || isComplete
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border/70 bg-background/80 text-muted-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                          isActive || isComplete
                            ? 'bg-primary-foreground/15 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {step === 'email' ? (
                  <motion.div
                    key="auth-email-copy"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2 text-center sm:text-left"
                  >
                    <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
                      Continue
                    </CardTitle>
                    <CardDescription className="max-w-md text-sm leading-6 text-muted-foreground">
                      {BRAND.description}
                    </CardDescription>
                  </motion.div>
                ) : (
                  <motion.div
                    key="auth-code-copy"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2 text-center sm:text-left"
                  >
                    <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
                      Check your inbox
                    </CardTitle>
                    <CardDescription className="max-w-md text-sm leading-6 text-muted-foreground">
                      Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
                    </CardDescription>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardHeader>

            <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
              <AnimatePresence mode="wait">
                {step === 'email' ? (
                  <motion.div
                    key="auth-email-step"
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="auth-email">Email address</Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="auth-email"
                            type="email"
                            name="email"
                            placeholder="name@example.com"
                            className="h-12 rounded-2xl border-border/70 bg-background pl-11 shadow-sm focus-visible:ring-offset-0"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoFocus
                            {...register('email')}
                          />
                        </div>
                        {errors.email ? (
                          <p className="text-sm text-destructive">{errors.email.message}</p>
                        ) : null}
                      </div>

                      {error ? (
                        <AuthNotice variant="error">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>{error}</p>
                        </AuthNotice>
                      ) : null}

                      {hint ? (
                        <AuthNotice variant="success">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p>{hint}</p>
                        </AuthNotice>
                      ) : null}

                      <div className="space-y-3">
                        <Button
                          type="submit"
                          className="h-12 w-full rounded-full shadow-sm"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending code
                            </>
                          ) : (
                            'Continue'
                          )}
                        </Button>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/70" />
                          </div>
                          <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            <span className="bg-card px-3">Or use a passkey</span>
                          </div>
                        </div>

                        {isIframe ? (
                          <AuthNotice variant="warning">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                            <p>Passkeys can fail inside preview mode. Open the app in a new tab if needed.</p>
                          </AuthNotice>
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full rounded-full border-border/70 bg-background/80 shadow-sm"
                          onClick={handlePasskeyLogin}
                          disabled={loading}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Sign in with passkey
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="auth-code-step"
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div className="rounded-[24px] border border-border/70 bg-muted/40 p-4 shadow-sm">
                      <div className="text-sm font-semibold text-foreground">Verification code</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Paste the 6-digit code to continue.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <OtpInput
                          value={code}
                          onChange={(value) => {
                            setCode(value);
                            setError(null);
                          }}
                          maxLength={6}
                          autoFocus
                        />
                      </div>

                      {error ? (
                        <AuthNotice variant="error" centered>
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <p>{error}</p>
                        </AuthNotice>
                      ) : null}

                      {hint ? (
                        <AuthNotice variant="success" centered>
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          <p>{hint}</p>
                        </AuthNotice>
                      ) : null}

                      <Button
                        type="button"
                        onClick={onCodeSubmit}
                        className="h-12 w-full rounded-full shadow-sm"
                        disabled={loading || code.length !== 6}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying
                          </>
                        ) : (
                          'Verify and continue'
                        )}
                      </Button>
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResendCode}
                        disabled={loading || cooldown > 0}
                        className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {cooldown > 0 ? (
                          <>Resend code in {cooldown}s</>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Resend code
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleChangeEmail}
                        className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                        Use a different email
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
          <PwaInstallCard className="bg-card/90" />
        </motion.div>
      </div>
    </div>
  );
}
