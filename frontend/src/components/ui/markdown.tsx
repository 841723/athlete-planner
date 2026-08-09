import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Components } from "react-markdown";

const components: Components = {
  h1: (props) => <h1 className="text-lg font-bold text-gray-100 mb-2 mt-3 first:mt-0" {...props} />,
  h2: (props) => <h2 className="text-base font-bold text-gray-100 mb-2 mt-3 first:mt-0" {...props} />,
  h3: (props) => <h3 className="text-sm font-bold text-gray-100 mb-2 mt-3 first:mt-0" {...props} />,
  h4: (props) => <h4 className="text-sm font-semibold text-gray-100 mb-1.5 mt-2.5 first:mt-0" {...props} />,
  p: (props) => <p className="text-sm leading-relaxed text-gray-200 mb-2 last:mb-0" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200 mb-2 last:mb-0" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-200 mb-2 last:mb-0" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-gray-100" {...props} />,
  em: (props) => <em className="italic text-gray-300" {...props} />,
  a: (props) => (
    <a className="text-accent-light underline hover:text-accent" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="border-l-2 border-dark-400 pl-3 italic text-gray-400 my-2" {...props} />
  ),
  code: (props) => (
    <code className="px-1 py-0.5 rounded bg-dark-300 text-accent-light text-xs" {...props} />
  ),
  pre: (props) => (
    <pre className="p-3 rounded-lg bg-dark-300 text-xs text-gray-200 overflow-x-auto my-2" {...props} />
  ),
  hr: () => <hr className="border-dark-400 my-3" />,
};

interface MarkdownProps {
  text?: string;
  className?: string;
}

export function Markdown({ text, className }: MarkdownProps) {
  if (!text) return null;
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
