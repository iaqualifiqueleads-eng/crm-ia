import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useLogin } from '@/features/auth/useLogin';

export function LoginPage() {
  const { login, loading } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await login(email, password);
  };

  return (
    <div className="min-h-screen flex bg-pearl">
      {/* ----- Painel esquerdo: editorial onyx ----- */}
      <div className="hidden lg:flex w-[44%] bg-onyx text-pearl relative overflow-hidden">
        <div className="absolute inset-0 bg-grain opacity-[0.07]" />
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-champagne/[0.06] blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[420px] h-[420px] rounded-full bg-champagne/[0.04] blur-3xl" />

        <div className="relative w-full flex flex-col justify-between p-14">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="display text-3xl">
                mar<span className="text-champagne">·</span>cha
              </span>
            </div>
            <div className="label-eyebrow text-platinum-100/50 mt-2">Customer Atelier · v.0.2</div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md"
          >
            <p className="label-eyebrow text-champagne mb-6">— Um manifesto de carteira</p>
            <h1 className="display text-5xl leading-[1.05] text-pearl">
              O cliente certo, <em className="text-champagne not-italic font-light">no instante exato</em> em que precisa de você.
            </h1>
            <p className="mt-8 text-platinum-100/70 text-sm leading-relaxed max-w-sm">
              Esta plataforma observa o ritmo de recompra do seu cliente, antecipa o
              próximo movimento e devolve à equipe comercial o tempo que o
              acompanhamento manual rouba.
            </p>
          </motion.div>

          <div className="flex items-center justify-between text-2xs uppercase tracking-micro text-platinum-100/40">
            <span>Espírito Santo · BR</span>
            <span>MMXXVI</span>
          </div>
        </div>
      </div>

      {/* ----- Painel direito: formulário ----- */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="label-eyebrow mb-3">Acesso restrito</div>
          <h2 className="display text-3xl text-onyx leading-tight">Bem-vindo de volta.</h2>
          <p className="text-sm text-smoke mt-2">
            Entre com suas credenciais corporativas.
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="você@empresa.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke hover:text-onyx"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
              Entrar
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-2xs text-smoke text-center tracking-wide pt-4">
              Esqueceu a senha? Solicite ao gerente da sua equipe.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
