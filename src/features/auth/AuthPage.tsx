import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { authApi } from '@/api/endpoints';
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
import { Loader2, ArrowLeft, Mail, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
    setValue: setEmailValue,
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

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
      setError(err.response?.data?.error?.message || 'Something went wrong');
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
      const { access_token, refresh_token } = response.data.data;
      setTokens(access_token, refresh_token);
      navigate('/chat');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Invalid code');
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
      setError(err.response?.data?.error?.message || 'Failed to resend code');
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

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {mode === 'login' ? 'Send Login Code' : 'Send Verification Code'}
                      </>
                    )}
                  </Button>
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
