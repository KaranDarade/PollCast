import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { signupSchema, loginSchema } from '../validators/auth';

export class AuthController {
  async signup(req: Request, res: Response) {
    const input = signupSchema.parse(req.body);
    const user = await authService.signup(input);
    res.status(201).json({ success: true, message: 'User created successfully', data: user });
  }

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const result = await authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  }

  async logout(req: Request, res: Response) {
    if (req.user) {
      await authService.logout(req.user.userId);
    }

    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    res.json({ success: true, message: 'Logged out successfully' });
  }

  async me(req: Request, res: Response) {
    const user = await authService.getMe(req.user!.userId);
    res.json({ success: true, data: user });
  }
}

export const authController = new AuthController();
