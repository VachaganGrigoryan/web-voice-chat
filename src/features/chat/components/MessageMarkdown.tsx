import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { parseMessageText } from '../utils/messageParserUtils';

interface MessageMarkdownProps {
  text: string;
  isOwn: boolean;
  className?: string;
}

const linkClasses = (isOwn: boolean) =>
  cn(
    "font-medium underline underline-offset-2 decoration-current transition-opacity hover:opacity-80 break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    isOwn
      ? "text-sky-300 hover:text-sky-200 dark:text-sky-700 dark:hover:text-sky-800"
      : "text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
  );

export const MessageMarkdown: React.FC<MessageMarkdownProps> = ({ text, isOwn, className }) => {
  const parsedText = useMemo(() => parseMessageText(text), [text]);

  return (
    <div className={cn("max-w-none text-inherit", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer noopener"
              className={linkClasses(isOwn)}
              onClick={(event) => event.stopPropagation()}
            />
          ),
          p: ({ ...props }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-inherit" {...props} />,
          em: ({ ...props }) => <em className="italic text-inherit" {...props} />,
          del: ({ ...props }) => <del className="line-through text-inherit opacity-80" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className={cn(
                "my-2 border-l-2 pl-3 italic",
                isOwn
                  ? "border-primary-foreground/40 text-primary-foreground/90"
                  : "border-border text-foreground/80"
              )}
              {...props}
            />
          ),
          ul: ({ ...props }) => <ul className="my-2 list-disc pl-5 space-y-1" {...props} />,
          ol: ({ ...props }) => <ol className="my-2 list-decimal pl-5 space-y-1" {...props} />,
          li: ({ ...props }) => <li className="pl-1" {...props} />,
          pre: ({ ...props }) => (
            <div
              className={cn(
                "my-2 overflow-hidden rounded-xl border",
                isOwn
                  ? "border-primary-foreground/15 bg-primary-foreground/10"
                  : "border-border bg-background/80 dark:bg-background/40"
              )}
            >
              <div className="overflow-x-auto p-3">
                <pre {...props} />
              </div>
            </div>
          ),
          code: ({ inline, className: codeClassName, children, ...props }: any) =>
            inline ? (
              <code
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[0.9em]",
                  isOwn
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-black/5 text-foreground dark:bg-white/10",
                  codeClassName
                )}
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className={cn(
                  "block min-w-max font-mono text-[13px] leading-6",
                  isOwn ? "text-primary-foreground" : "text-foreground",
                  codeClassName
                )}
                {...props}
              >
                {children}
              </code>
            ),
        }}
      >
        {parsedText.text}
      </ReactMarkdown>
    </div>
  );
};
