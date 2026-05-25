import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { RoleChip } from '@/components/ui/Chip';
import { api, extractErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, getInitials } from '@/lib/utils';

export function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (next.length < 8) {
      toast.error('A nova senha precisa ter pelo menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast.success('Senha alterada. Refaça o login.');
      if (refreshToken) {
        try { await api.post('/auth/logout', { refreshToken }); } catch {}
      }
      clearSession();
      navigate('/login');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (refreshToken) {
      try { await api.post('/auth/logout', { refreshToken }); } catch {}
    }
    clearSession();
    navigate('/login');
  };

  return (
    <>
      <PageHeader eyebrow="Conta" title="Minha conta" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Perfil */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center text-center py-10">
            <span className="h-20 w-20 rounded-sharp bg-onyx text-pearl text-2xl font-mono inline-flex items-center justify-center">
              {getInitials(user?.name)}
            </span>
            <h3 className="display text-xl text-onyx mt-5">{user?.name}</h3>
            <p className="text-sm text-smoke mt-1">{user?.email}</p>
            <div className="mt-4">{user && <RoleChip role={user.role} />}</div>

            <Button
              variant="ghost"
              onClick={handleLogout}
              icon={<LogOut className="h-4 w-4" />}
              className="mt-6"
            >
              Sair desta sessão
            </Button>
          </CardContent>
        </Card>

        {/* Troca de senha */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardEyebrow>Segurança</CardEyebrow>
              <CardTitle>Alterar senha</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChange} className="space-y-5 max-w-md">
              <div>
                <Label>Senha atual *</Label>
                <Input
                  required type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Nova senha *</Label>
                <Input
                  required type="password" minLength={8}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="font-mono"
                />
                <p className="text-2xs text-smoke mt-1.5">
                  Mínimo 8 caracteres, com letras e números.
                </p>
              </div>
              <div>
                <Label>Confirme a nova senha *</Label>
                <Input
                  required type="password" minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <p className="text-2xs text-smoke">
                  Você será desconectado de todos os dispositivos após alterar.
                </p>
                <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>
                  Alterar senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
