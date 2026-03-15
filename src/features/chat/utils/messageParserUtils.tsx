import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/shared/lib/utils';

export function parseMessageText(text: string, isOwn: boolean) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ node, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "underline break-all",
              isOwn ? "text-white hover:text-white/80" : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
        pre: ({ node, ...props }) => (
          <div className="relative my-2 rounded-md overflow-hidden bg-black/80 text-gray-100">
            <div className="flex items-center justify-between px-3 py-1 bg-black/90 text-xs text-gray-400">
              <span>code</span>
            </div>
            <div className="overflow-x-auto p-3 text-sm font-mono">
              <pre {...props} />
            </div>
          </div>
        ),
        code: ({ node, className, children, ...props }: any) => {
          return (
            <code className={cn("bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono text-[0.9em]", className)} {...props}>
              {children}
            </code>
          );
        },
        ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2" {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-primary/30 pl-3 italic my-2" {...props} />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function replaceAsciiSmiles(text: string): string {
  const smileMap: Record<string, string> = {
    ':)': '😊',
    ':D': '😃',
    ';)': '😉',
    ':(': '😞',
    ':P': '😛',
    '<3': '❤️',
  };
  
  let result = text;
  for (const [ascii, emoji] of Object.entries(smileMap)) {
    // Basic replacement, could be improved with regex to avoid replacing inside words
    result = result.replace(new RegExp(ascii.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), emoji);
  }
  return result;
}
