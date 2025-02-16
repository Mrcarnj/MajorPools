import { LucideProps } from 'lucide-react';

export function GolfIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 18v-2" />
      <path d="M8 8a4 4 0 0 1 8 0v6" />
      <path d="M10 20h4" />
      <path d="M7 14c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2" />
    </svg>
  );
}