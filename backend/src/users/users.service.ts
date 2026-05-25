import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ResetUserPasswordDto } from './dto/users.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { canManageUser } from '../common/scope.util';
import { PaginationDto, buildPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------
  // CREATE — regras:
  //  - MANAGER pode criar SUPERVISOR e SALESPERSON
  //  - SUPERVISOR pode criar apenas SALESPERSON, e supervisorId = ele mesmo
  //  - Nunca se cria outro MANAGER por endpoint (apenas seed)
  // -------------------------------------------------------
  async create(actor: CurrentUserPayload, dto: CreateUserDto) {
    if (dto.role === UserRole.MANAGER) {
      throw new ForbiddenException('Não é possível criar outro gerente pelo sistema');
    }

    if (actor.role === UserRole.SALESPERSON) {
      throw new ForbiddenException('Vendedores não podem criar usuários');
    }

    if (actor.role === UserRole.SUPERVISOR && dto.role !== UserRole.SALESPERSON) {
      throw new ForbiddenException('Supervisores só podem criar vendedores');
    }

    // Resolução do supervisorId
    let supervisorId: string | null = dto.supervisorId ?? null;

    if (actor.role === UserRole.SUPERVISOR) {
      // Força supervisorId = o próprio supervisor logado
      supervisorId = actor.sub;
    } else if (actor.role === UserRole.MANAGER) {
      if (dto.role === UserRole.SUPERVISOR) {
        // Supervisor sempre reporta ao MANAGER atual
        supervisorId = actor.sub;
      } else if (dto.role === UserRole.SALESPERSON) {
        // Vendedor precisa de supervisor explícito; se não vier, atribui ao próprio gerente
        if (!supervisorId) supervisorId = actor.sub;
      }
    }

    // Valida que o supervisorId aponta para um usuário válido com role compatível
    if (supervisorId) {
      const supervisor = await this.prisma.user.findFirst({
        where: { id: supervisorId, isActive: true, deletedAt: null },
        select: { id: true, role: true },
      });
      if (!supervisor) {
        throw new BadRequestException('Supervisor informado não existe ou está inativo');
      }
      if (supervisor.role === UserRole.SALESPERSON) {
        throw new BadRequestException('Um vendedor não pode ser supervisor de outro usuário');
      }
    }

    // Verifica duplicidade de e-mail
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        phone: dto.phone,
        supervisorId,
      },
      select: this.publicSelect(),
    });

    return user;
  }

  // -------------------------------------------------------
  // LIST — escopo por papel
  // -------------------------------------------------------
  async findAll(actor: CurrentUserPayload, pagination: PaginationDto, role?: UserRole) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(pagination.search
        ? {
            OR: [
              { name: { contains: pagination.search } },
              { email: { contains: pagination.search } },
            ],
          }
        : {}),
    };

    if (actor.role === UserRole.SUPERVISOR) {
      where.OR = [
        ...((where.OR as any[]) ?? []),
      ];
      // Restringe a si mesmo + subordinados
      where.AND = [{ OR: [{ id: actor.sub }, { supervisorId: actor.sub }] }];
    } else if (actor.role === UserRole.SALESPERSON) {
      where.id = actor.sub; // só ele mesmo
    }
    // MANAGER vê tudo

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: this.publicSelect(),
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // -------------------------------------------------------
  // GET BY ID
  // -------------------------------------------------------
  async findOne(actor: CurrentUserPayload, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.publicSelect(true),
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const canView = await canManageUser(this.prisma, actor, id);
    if (!canView) throw new ForbiddenException('Sem permissão para visualizar este usuário');

    return user;
  }

  // -------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------
  async update(actor: CurrentUserPayload, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!target) throw new NotFoundException('Usuário não encontrado');

    const allowed = await canManageUser(this.prisma, actor, id);
    if (!allowed) throw new ForbiddenException('Sem permissão para editar este usuário');

    // Bloqueios específicos:
    if (dto.role && dto.role !== target.role) {
      if (actor.role !== UserRole.MANAGER) {
        throw new ForbiddenException('Apenas o gerente pode alterar papéis');
      }
      if (dto.role === UserRole.MANAGER) {
        throw new ForbiddenException('Não é possível promover outro usuário a gerente');
      }
      if (target.role === UserRole.MANAGER) {
        throw new ForbiddenException('Não é possível rebaixar o gerente');
      }
    }

    // Se mudou supervisorId, valida
    if (dto.supervisorId !== undefined && dto.supervisorId !== target.supervisorId) {
      if (actor.role === UserRole.SALESPERSON) {
        throw new ForbiddenException('Sem permissão');
      }
      if (dto.supervisorId) {
        const newSup = await this.prisma.user.findFirst({
          where: { id: dto.supervisorId, isActive: true, deletedAt: null },
        });
        if (!newSup) throw new BadRequestException('Supervisor inválido');
        if (newSup.role === UserRole.SALESPERSON) {
          throw new BadRequestException('Um vendedor não pode ser supervisor');
        }
        if (newSup.id === target.id) {
          throw new BadRequestException('Usuário não pode ser supervisor de si mesmo');
        }
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        supervisorId: dto.supervisorId,
        phone: dto.phone,
        isActive: dto.isActive,
      },
      select: this.publicSelect(true),
    });

    return updated;
  }

  // -------------------------------------------------------
  // RESET PASSWORD (admin) — manager/supervisor reseta senha de subordinado
  // -------------------------------------------------------
  async resetPassword(actor: CurrentUserPayload, id: string, dto: ResetUserPasswordDto) {
    const allowed = await canManageUser(this.prisma, actor, id);
    if (!allowed) throw new ForbiddenException('Sem permissão');

    const target = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw new NotFoundException('Usuário não encontrado');

    if (target.id === actor.sub) {
      throw new BadRequestException('Use o endpoint /auth/change-password para alterar sua própria senha');
    }

    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Revoga tokens — força re-login
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // -------------------------------------------------------
  // DEACTIVATE / SOFT DELETE
  // -------------------------------------------------------
  async deactivate(actor: CurrentUserPayload, id: string) {
    if (id === actor.sub) {
      throw new BadRequestException('Não é possível desativar a si mesmo');
    }

    const allowed = await canManageUser(this.prisma, actor, id);
    if (!allowed) throw new ForbiddenException('Sem permissão');

    const target = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw new NotFoundException('Usuário não encontrado');

    if (target.role === UserRole.MANAGER) {
      throw new ForbiddenException('Não é possível desativar o gerente');
    }

    // Verifica se tem clientes na carteira — exige transferência antes
    const customerCount = await this.prisma.customer.count({
      where: { salespersonId: id, deletedAt: null },
    });
    if (customerCount > 0) {
      throw new BadRequestException(
        `Este usuário possui ${customerCount} cliente(s) na carteira. Transfira-os antes de desativar.`,
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // -------------------------------------------------------
  // ME — perfil do usuário logado
  // -------------------------------------------------------
  async me(actor: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: this.publicSelect(true),
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  private publicSelect(detailed = false) {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      avatarUrl: true,
      isActive: true,
      supervisorId: true,
      createdAt: true,
      ...(detailed
        ? {
            updatedAt: true,
            supervisor: { select: { id: true, name: true, role: true } },
            _count: { select: { customers: true, subordinates: true } },
          }
        : {}),
    } satisfies Prisma.UserSelect;
  }
}
