import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'billiard_admin_supersecret_jwt_2026'
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      fullName: payload.fullName
    };
  }
}
