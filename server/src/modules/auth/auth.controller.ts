import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
  ) {
    return this.authService.login(body.username, body.password);
  }

  @Post('register')
  async register(
    @Body()
    body: {
      username: string;
      password: string;
      name: string;
      role: string;
    },
  ) {
    return this.authService.register(
      body.username,
      body.password,
      body.name,
      body.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }
}
