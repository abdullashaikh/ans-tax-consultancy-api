import { SettingRepository } from '../repositories/setting.repository';

export class SettingService {
  static async getPublicSettings() {
    return SettingRepository.listPublic();
  }

  static async getSetting(key: string) {
    return SettingRepository.get(key);
  }

  static async updateSetting(params: {
    key: string;
    value: string;
    type?: string;
    description?: string;
    isPublic?: boolean;
  }) {
    return SettingRepository.set(params);
  }
}
