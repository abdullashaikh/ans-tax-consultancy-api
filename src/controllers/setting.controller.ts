import { Request, Response, NextFunction } from 'express';
import { SettingService } from '../services/setting.service';
import { ResponseFormatter } from '../utils/apiResponse';

export class SettingController {
  static async listPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SettingService.getPublicSettings();
      ResponseFormatter.success(res, settings);
    } catch (error) {
      next(error);
    }
  }

  static async getByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const setting = await SettingService.getSetting(req.params['key']!);
      ResponseFormatter.success(res, setting);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await SettingService.updateSetting(req.body);
      ResponseFormatter.success(res, null, 'Setting updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
