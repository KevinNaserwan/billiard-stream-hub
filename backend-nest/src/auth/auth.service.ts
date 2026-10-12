import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

export interface UserPayload {
  userId: number;
  username: string;
  role: string;
  fullName: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  private hashPassword(password: string): string {
    return crypto.createHmac('sha256', 'billiard_salt_2026').update(password).digest('hex');
  }

  private users = [
    {
      id: 1,
      username: 'admin',
      passwordHash: this.hashPassword('admin123'),
      fullName: 'Chief Operator Admin',
      role: 'superadmin'
    },
    {
      id: 2,
      username: 'kasir',
      passwordHash: this.hashPassword('kasir123'),
      fullName: 'Kasir Frontdesk',
      role: 'cashier'
    }
  ];

  validateUser(username: string, pass: string): UserPayload {
    const user = this.users.find(u => u.username === username);
    if (!user) throw new UnauthorizedException('Username atau password salah');
    
    if (user.passwordHash !== this.hashPassword(pass)) {
      throw new UnauthorizedException('Username atau password salah');
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName
    };
  }

  login(user: UserPayload) {
    return {
      status: 'success',
      token: this.jwtService.sign(user),
      user
    };
  }
}
