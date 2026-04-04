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

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const AUTH_STEPS = [
  { id: 'email', label: 'Email' },
  { id: 'code', label: 'Code' },
] as const;

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
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#f8fafc_0%,_#fef7f7_52%,_#fffaf5_100%)] px-4 py-6 sm:px-6">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.12),_transparent_60%)]" />
      <div className="absolute left-1/2 top-28 h-56 w-56 -translate-x-1/2 rounded-full bg-rose-200/35 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
          className="w-full"
        >
          <Card className="overflow-hidden rounded-[30px] border border-rose-100/80 bg-white/92 shadow-[0_28px_70px_rgba(15,23,42,0.10)] backdrop-blur">
            <CardHeader className="space-y-5 border-b border-rose-100/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(255,247,247,0.96))] px-6 pb-6 pt-7 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-600">
                  <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]" />
                  Voca
                </div>
                <div className="text-xs font-medium text-slate-400">Secure sign in</div>
              </div>

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
                          ? 'border-rose-500 bg-rose-500 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                          isActive || isComplete
                            ? 'bg-white/18 text-white'
                            : 'bg-white text-slate-500'
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
                    <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
                      Continue
                    </CardTitle>
                    <CardDescription className="max-w-md text-sm leading-6 text-slate-500">
                      Enter your email to get a verification code.
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
                    <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
                      Check your inbox
                    </CardTitle>
                    <CardDescription className="max-w-md text-sm leading-6 text-slate-500">
                      Enter the 6-digit code sent to <span className="font-medium text-slate-900">{email}</span>.
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
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id="auth-email"
                            type="email"
                            name="email"
                            placeholder="name@example.com"
                            className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 text-slate-900 placeholder:text-slate-400 focus-visible:border-rose-300 focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-0"
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
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {error}
                        </div>
                      ) : null}

                      {hint ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          {hint}
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        <Button
                          type="submit"
                          className="h-12 w-full rounded-full bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-300"
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
                            <span className="w-full border-t border-slate-200" />
                          </div>
                          <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            <span className="bg-white px-3">Or use a passkey</span>
                          </div>
                        </div>

                        {isIframe ? (
                          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>Passkeys can fail inside preview mode. Open the app in a new tab if needed.</p>
                          </div>
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-200"
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
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">Verification code</div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
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
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
                          {error}
                        </div>
                      ) : null}

                      {hint ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
                          {hint}
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        onClick={onCodeSubmit}
                        className="h-12 w-full rounded-full bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-300"
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
                        className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
                        variant="link"
                        size="sm"
                        onClick={handleChangeEmail}
                        className="text-slate-500 hover:text-slate-900"
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
        </motion.div>
      </div>
    </div>
  );
}
