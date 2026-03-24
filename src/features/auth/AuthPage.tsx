import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { authApi } from '@/api/endpoints';
import { getDefaultAuthedPath } from '@/app/routes';
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
import { Loader2, ArrowLeft, Mail, Check, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startAuthentication } from '@simplewebauthn/browser';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export default function AuthPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isIframe, setIsIframe] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || getDefaultAuthedPath();
  const setTokens = useAuthStore((state) => state.setTokens);

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
    setValue: setEmailValue,
    getValues: getEmailValues,
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    setIsIframe(window !== window.top);
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

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
      setCooldown(30); // Start 30s cooldown
    } catch (err: any) {
      console.error(err);
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    const data = getEmailValues();
    if (!data.email) {
      setError('Please enter your email first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Get options from server
      const optionsPayload = await authApi.passkeys.loginStart(data.email) as Record<string, any>;
      const options = 'optionsJSON' in optionsPayload
        ? { ...optionsPayload }
        : { optionsJSON: optionsPayload };

      if (options.optionsJSON) {
        options.optionsJSON.userVerification = 'preferred';
      }

      // 2. Call browser API
      const credential = await startAuthentication(options as Parameters<typeof startAuthentication>[0]);

      // 3. Send credential to server
      const verifyRes = await authApi.passkeys.loginFinish({ email: data.email, credential });
      
      // 4. Handle success (extract tokens directly from response based on spec)
      const { access_token, refresh_token } = verifyRes;
      setTokens(access_token, refresh_token);
      navigate(redirectUrl);
    } catch (err: any) {
      console.error('Passkey login failed:', err);
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || err.message || 'Passkey login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onCodeSubmit = async () => {
    if (code.length !== 6) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.verify(email, code);
      const { access_token, refresh_token } = response;
      setTokens(access_token, refresh_token);
      navigate(redirectUrl);
    } catch (err: any) {
      console.error(err);
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Invalid code';
      setError(message);
      setCode(''); // Clear code on error
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await authApi.login(email);
      } else {
        await authApi.register(email);
      }
      setCooldown(30);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to resend code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    // Keep email value in form so user can edit it
    setEmailValue('email', email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md overflow-hidden transition-all duration-300">
        <CardHeader className="space-y-1">
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.div
                key="email-header"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-1"
              >
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full border-[3px] border-red-500 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                    </div>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-center">
                  Welcome to Voca
                </CardTitle>
                <CardDescription className="text-center">
                  A new era secure and fast messenger
                </CardDescription>
              </motion.div>
            ) : (
              <motion.div
                key="code-header"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-1"
              >
                <CardTitle className="text-2xl font-bold text-center">
                  Check your inbox
                </CardTitle>
                <CardDescription className="text-center">
                  We sent a verification code to <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </motion.div>
            )}
          </AnimatePresence>
        </CardHeader>
        
        <CardContent>
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-center text-sm font-medium">
                  <button
                    onClick={() => setMode('login')}
                    className={cn(
                      "rounded-md py-1.5 transition-all",
                      mode === 'login' 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setMode('register')}
                    className={cn(
                      "rounded-md py-1.5 transition-all",
                      mode === 'register' 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    Register
                  </button>
                </div>

                <form onSubmit={handleSubmitEmail(onEmailSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        className="pl-9"
                        {...registerEmail('email')}
                        autoFocus
                      />
                    </div>
                    {emailErrors.email && (
                      <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                        {emailErrors.email.message}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {mode === 'login' ? 'Send Login Code' : 'Send Verification Code'}
                        </>
                      )}
                    </Button>

                    {mode === 'login' && (
                      <>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted-foreground/20" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                          </div>
                        </div>

                        {isIframe && (
                          <div className="rounded-md bg-amber-500/15 p-3 text-xs text-amber-600 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>
                              Passkeys may fail in preview mode. If so, <strong>open the app in a new tab</strong>.
                            </p>
                          </div>
                        )}

                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full" 
                          disabled={loading}
                          onClick={handlePasskeyLogin}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Sign in with Passkey
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="code-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <OtpInput
                      value={code}
                      onChange={(val) => {
                        setCode(val);
                        setError(null);
                      }}
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  
                  {error && (
                    <div className="text-center text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                      {error}
                    </div>
                  )}

                  <Button 
                    onClick={onCodeSubmit} 
                    className="w-full" 
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Verify Code <Check className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex flex-col items-center gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResendCode}
                    disabled={cooldown > 0 || loading}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {cooldown > 0 ? (
                      <span className="flex items-center">
                        Resend code in {cooldown}s
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <RefreshCw className="mr-2 h-3 w-3" /> Resend code
                      </span>
                    )}
                  </Button>

                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleChangeEmail}
                    className="text-muted-foreground"
                  >
                    <ArrowLeft className="mr-2 h-3 w-3" /> Change email
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
