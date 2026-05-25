import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from './decorators/current-user.decorator';

/**
 * Retorna a lista de userIds (vendedores) que o usuário logado pode visualizar.
 *
 * Regras:
 *  - MANAGER     -> vê todos os usuários ativos
 *  - SUPERVISOR  -> vê a si mesmo + todos os subordinados (vendedores) diretos
 *  - SALESPERSON -> vê apenas a si mesmo
 *
 * Esse array é usado como filtro `where: { salespersonId: { in: [...] } }`
 * nas queries de Customer, Order, Task etc.
 */
export async function getVisibleSalespersonIds(
  prisma: PrismaService,
  user: CurrentUserPayload,
): Promise<string[]> {
  if (user.role === UserRole.MANAGER) {
    const all = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    return all.map((u) => u.id);
  }

  if (user.role === UserRole.SUPERVISOR) {
    const subordinates = await prisma.user.findMany({
      where: { supervisorId: user.sub, isActive: true, deletedAt: null },
      select: { id: true },
    });
    return [user.sub, ...subordinates.map((u) => u.id)];
  }

  // SALESPERSON
  return [user.sub];
}

/**
 * Verifica se o usuário pode gerenciar (editar/transferir/etc.) outro usuário.
 *  - MANAGER    -> pode gerenciar qualquer um
 *  - SUPERVISOR -> pode gerenciar apenas subordinados diretos
 *  - SALESPERSON -> não gerencia ninguém
 */
export async function canManageUser(
  prisma: PrismaService,
  actor: CurrentUserPayload,
  targetUserId: string,
): Promise<boolean> {
  if (actor.sub === targetUserId) return true;
  if (actor.role === UserRole.MANAGER) return true;
  if (actor.role === UserRole.SUPERVISOR) {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { supervisorId: true },
    });
    return target?.supervisorId === actor.sub;
  }
  return false;
}
