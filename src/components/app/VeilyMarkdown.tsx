import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="my-2 border-l-2 border-[#f0ac5e] pl-3 text-slate-600 dark:text-mist">{children}</blockquote>,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => <a className="underline decoration-[#f0ac5e] underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.9em] dark:bg-ink-700">{children}</code>,
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="my-2 overflow-x-auto rounded-lg bg-slate-200/70 p-3 font-mono text-xs dark:bg-ink-900">{children}</pre>,
  table: ({ children }: { children?: React.ReactNode }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="border-b border-slate-300 px-2 py-1 font-semibold dark:border-ink-600">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="border-b border-slate-200 px-2 py-1 dark:border-ink-700">{children}</td>,
};

export function VeilyMarkdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>;
}
