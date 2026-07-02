import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { UnauthorizedError, ConflictError } from '../utils/errors';
import type { SignupInput, LoginInput, UpdateProfileInput } from '../validators/auth';

export class AuthService {
  async signup(input: SignupInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictError('Email already registered', 'EMAIL_EXISTS');
    }

    const participantRole = await prisma.role.findUnique({
      where: { name: 'PARTICIPANT' },
    });

    if (!participantRole) {
      throw new Error('Participant role not found. Run seed first.');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        roleId: participantRole.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { name: true } },
        createdAt: true,
      },
    });

    return user;
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokenId = uuidv4();
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role.name,
      email: user.email,
    });
    const refreshToken = generateRefreshToken({ userId: user.id, tokenId });

    // Store session
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { userId: string; tokenId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const newTokenId = uuidv4();
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role.name,
      email: user.email,
    });
    const newRefreshToken = generateRefreshToken({ userId: user.id, tokenId: newTokenId });

    const refreshHash = await bcrypt.hash(newRefreshToken, 10);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
    };
  }

  async logout(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: { select: { name: true } },
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return user;
  }

  async updateMe(userId: string, input: UpdateProfileInput) {
    const data: Record<string, any> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.avatar !== undefined) data.avatar = input.avatar;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: { select: { name: true } },
        emailVerified: true,
        createdAt: true,
      },
    });

    return user;
  }
}

export const authService = new AuthService();
