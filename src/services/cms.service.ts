import { CmsRepository } from '../repositories/cms.repository';
import { ApiError } from '../utils/apiError';
import { ErrorCodes } from '../constants/errorCodes';
import { BlogPostStatus } from '../types/models';

export class CmsService {
  static async listFaqs(serviceId?: number) {
    return CmsRepository.listFaqs(serviceId, true);
  }

  static async listBlogPosts(params: { categoryId?: number; status?: BlogPostStatus; limit: number; offset: number }) {
    return CmsRepository.listBlogPosts(params);
  }

  static async getBlogPostBySlug(slug: string) {
    const post = await CmsRepository.findBlogPostBySlug(slug);
    if (!post) {
      throw ApiError.notFound('Blog post not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return post;
  }
}
