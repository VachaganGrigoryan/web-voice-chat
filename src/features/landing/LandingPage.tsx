import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  FileStack,
  ImageIcon,
  LockKeyhole,
  MessageCircleMore,
  Mic,
  PhoneCall,
  PlayCircle,
  Shield,
  Sparkles,
  Sticker,
  Video,
} from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Logo } from '@/shared/branding/Logo';
import { PwaInstallCard } from '@/shared/branding/PwaInstallCard';
import { BRAND } from '@/shared/branding/brand';

const callHighlights = [
  {
    title: 'Voice calls',
    description: 'Start low-friction audio calls when text is too slow.',
    icon: PhoneCall,
  },
  {
    title: 'Video calls',
    description: 'Escalate a chat into face-to-face conversation without leaving Vogi.',
    icon: Video,
  },
  {
    title: 'Realtime flow',
    description: 'Messages, media, and call updates stay inside the same thread.',
    icon: Sparkles,
  },
] as const;

const messageTypes = [
  { label: 'Text', icon: MessageCircleMore },
  { label: 'Images', icon: ImageIcon },
  { label: 'Video', icon: PlayCircle },
  { label: 'Voice notes', icon: Mic },
  { label: 'Files', icon: FileStack },
  { label: 'Call events', icon: PhoneCall },
  { label: 'Emoji', icon: Sparkles },
  { label: 'Stickers', icon: Sticker },
] as const;

const timelineItems = [
  {
    title: 'Video call ready',
    detail: 'Switch from chat to live video with shared call status in-thread.',
  },
  {
    title: 'Voice note sent',
    detail: 'Audio messages live next to text, media, and follow-up replies.',
  },
  {
    title: 'Files and media',
    detail: 'Send images, videos, and documents inside the same conversation flow.',
  },
] as const;

const roadmapItems = [
  'Current chat and calling surfaces are available in one app shell.',
  'Incoming end-to-end encryption support is planned and should be presented as upcoming.',
  'Installable web app support is already wired for faster return sessions.',
] as const;

export default function LandingPage() {
  const scrollToDetails = () => {
    document.getElementById('landing-details')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/70 bg-background">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4 py-3">
            <Logo variant="wordmark" size="md" />
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="rounded-full px-4">
                <Link to={APP_ROUTES.auth}>Sign in</Link>
              </Button>
              <Button asChild className="rounded-full px-5">
                <Link to={APP_ROUTES.auth}>
                  Open app
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto max-w-3xl pt-12 text-center sm:pt-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <BadgeCheck className="h-3.5 w-3.5" />
                Chat, voice, and video in one thread
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {BRAND.name} keeps conversation, calls, and shared media in one place.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                A chat-first communication app with realtime messaging, voice notes, file sharing,
                and fast handoff into voice or video calls.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link to={APP_ROUTES.auth}>
                    Start with Vogi
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="rounded-full px-6"
                  onClick={scrollToDetails}
                >
                  Explore features
                </Button>
              </div>
            </div>

            <div className="mt-12 sm:mt-16">
              <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <div className="border-b border-border/70 bg-muted/30 px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Vogi conversation flow</p>
                      <p className="text-sm text-muted-foreground">
                        Messaging, media, and call states stay visible in one timeline.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-600 dark:text-emerald-400">
                      <Shield className="h-4 w-4" />
                      Incoming E2EE support
                    </div>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="border-b border-border/70 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                          Ready to switch to video? I can walk through the mockup live.
                        </div>
                      </div>
                      <div className="max-w-[88%] rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">Voice note</span>
                          <span className="text-xs text-muted-foreground">0:18</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-muted">
                          <div className="h-2 w-2/3 rounded-full bg-primary" />
                        </div>
                      </div>
                      <div className="max-w-[92%] rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">Project handoff.mp4</span>
                          <span className="text-xs text-muted-foreground">Video</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Shared directly inside the conversation so replies stay anchored to the file.
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[88%] rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
                          Call connected. Camera on, mic on.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="space-y-5">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Supported message flow</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Built around mixed-format conversations instead of a text-only inbox.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {messageTypes.map(({ label, icon: Icon }) => (
                          <div
                            key={label}
                            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {label}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {timelineItems.map((item) => (
                          <div key={item.title} className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                            <div className="text-sm font-medium text-foreground">{item.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="landing-details" className="border-b border-border/70 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Product surface
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Vogi is built for conversations that move between typing, sharing, and calling.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {callHighlights.map(({ title, description, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-border/70 bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Privacy roadmap
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Secure today, with end-to-end encryption support positioned as the next step.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              The landing page should present current messaging and call support directly, while
              keeping E2EE language accurate: it is an incoming capability, not a shipped promise.
            </p>
            <div className="mt-6 space-y-3">
              {roadmapItems.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <PwaInstallCard className={cn('h-fit rounded-xl border-border/70 bg-card')} showUnavailableState />
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Open Vogi and move from messages to calls without changing tools.
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Keep one app entry for conversation history, media sharing, voice notes, and live calls.
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full px-6">
            <Link to={APP_ROUTES.auth}>
              Open app
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
