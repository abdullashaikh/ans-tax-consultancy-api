import { CmsRepository } from '../repositories/cms.repository';
import { AuditService } from '../middleware/audit.middleware';

export class CmsService {
  static async getPublicContent(sectionKey?: string) {
    const items = await CmsRepository.listPublished(sectionKey);
    // Group into structured object by section and key
    const grouped: Record<string, Record<string, string | null>> = {};
    for (const item of items) {
      if (!grouped[item.section_key]) {
        grouped[item.section_key] = {};
      }
      grouped[item.section_key]![item.content_key] = item.content_value;
    }
    return { items, grouped };
  }

  static async getAllContent() {
    const items = await CmsRepository.listAll();
    const grouped: Record<string, Record<string, any>> = {};
    for (const item of items) {
      if (!grouped[item.section_key]) {
        grouped[item.section_key] = {};
      }
      grouped[item.section_key]![item.content_key] = {
        value: item.content_value,
        type: item.content_type,
        isPublished: item.is_published,
        displayOrder: item.display_order,
      };
    }
    return { items, grouped };
  }

  static async updateContentBatch(
    items: Array<{
      sectionKey: string;
      contentKey: string;
      contentValue: string | null;
      contentType?: string;
      displayOrder?: number;
      isPublished?: boolean;
    }>,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    for (const item of items) {
      await CmsRepository.upsertContent({
        ...item,
        updatedBy: userId,
      });
    }

    await AuditService.log({
      userId,
      action: 'CMS_CONTENT_UPDATED',
      entityType: 'WEBSITE_CONTENT',
      newValues: { updatedCount: items.length, sections: [...new Set(items.map((i) => i.sectionKey))] },
      ipAddress,
      userAgent,
    });

    return this.getAllContent();
  }

  // ==========================================================================
  // FAQS & BLOG POSTS
  // ==========================================================================

  static async listFaqs(serviceId?: number) {
    return CmsRepository.listFaqs(serviceId);
  }

  static async listBlogPosts(params: { categoryId?: number; limit: number; offset: number }) {
    return CmsRepository.listBlogPosts(params);
  }

  static async getBlogPostBySlug(slug: string) {
    return CmsRepository.findBlogPostBySlug(slug);
  }
}
