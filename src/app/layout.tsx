import type { ReactNode } from 'react';
import './prototype.css';

export const metadata = { title: 'Doneward · Design prototype', description: 'Throwaway design explorations for Doneward.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
