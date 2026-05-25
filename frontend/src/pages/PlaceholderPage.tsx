import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';

export function PlaceholderPage({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <Card>
        <CardContent className="py-24 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-sharp bg-onyx text-champagne inline-flex items-center justify-center mb-6">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="display text-2xl text-onyx">Em construção</h3>
          <p className="text-sm text-smoke max-w-md mt-3">
            Este módulo será entregue na <strong className="text-onyx">Fase 2.2</strong>.
            O backend já está pronto e funcional — basta plugarmos a UI editorial nele.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
