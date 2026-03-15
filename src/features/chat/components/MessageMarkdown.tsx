import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/lib/utils';

interface MessageMarkdownProps {
  text: string;
  isMe: boolean;
}

const SMILE_MAP: Record<string, string> = {
  ':)': '🙂',
  ':D': '😃',
  ';)': '😉',
  ':(': '🙁',
  ':P': '😛',
  ':p': '😛',
  '<3': '❤️',
  ':O': '😮',
  ':o': '😮',
};

const processSmiles = (text: string) => {
  let processed = text;
  Object.entries(SMILE_MAP).forEach(([smile, emoji]) => {
    // Replace smiles that are not part of a word
    const regex = new RegExp(`(?<=\\s|^)${smile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
    processed = processed.replace(regex, emoji);
  });
  return processed;
};

export const MessageMarkdown: React.FC<MessageMarkdownProps> = ({ text, isMe }) => {
  const processedText = useMemo(() => {
    if (!text) return '';
    return processSmiles(text);
  }, [text]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-1 prose-pre:bg-zinc-800 prose-pre:text-zinc-100 text-inherit prose-p:text-inherit prose-headings:text-inherit prose-strong:text-inherit">
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
                isMe 
                  ? "!text-blue-400 hover:!text-blue-300 dark:!text-blue-600 dark:hover:!text-blue-800" 
                  : "!text-blue-600 hover:!text-blue-800 dark:!text-blue-400 dark:hover:!text-blue-300"
              )}
              onClick={(e) => e.stopPropagation()}
            />
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            return (
              <code
                className={cn(
                  "bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-sm",
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          }
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};
