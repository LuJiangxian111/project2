import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {
    this.initAdmin();
  }

  private async initAdmin() {
    const admin = await this.userRepository.findOne({
      where: { username: 'admin' },
    });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.userRepository.save({
        username: 'admin',
        password: hashedPassword,
        name: '管理员',
        role: 'admin',
      });
      console.log('Admin user created: admin / admin123');
    }
  }

  async login(username: string, password: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);
    const { password: _, ...result } = user;
    return { token, user: result };
  }

  async register(
    username: string,
    password: string,
    name: string,
    role: string,
  ) {
    const existing = await this.userRepository.findOne({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      name,
      role: role as 'admin' | 'hr' | 'pm' | 'interviewer',
    });
    await this.userRepository.save(user);
    const { password: _, ...result } = user;
    return result;
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    const { password: _, ...result } = user;
    return result;
  }

  async validateUser(userId: number) {
    return this.userRepository.findOne({ where: { id: userId } });
  }
}
