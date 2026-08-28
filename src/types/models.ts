export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
export type ClientType = 'INDIVIDUAL' | 'BUSINESS';
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type AddressType = 'RESIDENTIAL' | 'BUSINESS' | 'REGISTERED_OFFICE' | 'BILLING' | 'CORRESPONDENCE';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DOCUMENTS_PENDING'
  | 'DOCUMENTS_RECEIVED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PAYMENT_PENDING'
  | 'FILED'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'REJECTED';

export type ApplicationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type DocumentStatus = 'UPLOADED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST' | 'CLOSED';
export type AppointmentType = 'IN_PERSON' | 'PHONE' | 'VIDEO';
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type NotificationType = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
export type BlogPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface UserRecord {
  id: number;
  public_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  password_hash?: string;
  status: UserStatus;
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ClientRecord {
  id: number;
  public_id: string;
  user_id: number;
  client_type: ClientType;
  legal_name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  business_type: string | null;
  gstin: string | null;
  pan_reference: string | null;
  status: ClientStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ServiceCategoryRecord {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface ServiceRecord {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  icon?: string | null;
  short_description: string | null;
  description: string | null;
  features?: any | null;
  eligibility: string | null;
  documents_required_description: string | null;
  processing_time: string | null;
  base_price: string | null; // DECIMAL stored as string
  discount_price?: string | null;
  currency: string;
  is_active: boolean;
  is_featured?: boolean;
  display_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface ServicePriceHistoryRecord {
  id: number;
  service_id: number;
  previous_base_price: string | null;
  new_base_price: string;
  previous_discount_price: string | null;
  new_discount_price: string | null;
  currency: string;
  changed_by: number | null;
  reason: string | null;
  created_at: Date;
  changed_by_name?: string | null;
}

export interface WebsiteContentRecord {
  id: number;
  section_key: string;
  content_key: string;
  content_value: string | null;
  content_type: 'TEXT' | 'HTML' | 'JSON' | 'IMAGE_URL' | 'BOOLEAN';
  display_order: number;
  is_published: boolean;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApplicationRecord {
  id: number;
  public_id: string;
  application_number: string;
  client_id: number;
  service_id: number;
  assigned_consultant_id: number | null;
  title: string;
  description: string | null;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  quoted_amount: string | null;
  final_amount: string | null;
  currency: string;
  submitted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentRecord {
  id: number;
  public_id: string;
  client_id: number;
  application_id: number | null;
  document_type_id: number;
  original_file_name: string;
  storage_provider: string;
  storage_object_key: string;
  mime_type: string;
  file_size: number;
  checksum: string | null;
  version: number;
  uploaded_by: number;
  status: DocumentStatus;
  uploaded_at: Date;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface LeadRecord {
  id: number;
  public_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service_id: number | null;
  business_type: string | null;
  city: string | null;
  message: string | null;
  source: string | null;
  status: LeadStatus;
  assigned_to: number | null;
  converted_client_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRecord {
  id: number;
  public_id: string;
  client_id: number;
  application_id: number;
  payment_reference: string;
  amount: string;
  currency: string;
  payment_gateway: string | null;
  gateway_transaction_id: string | null;
  payment_method: string | null;
  status: PaymentStatus;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AppointmentRecord {
  id: number;
  public_id: string;
  client_id: number;
  consultant_id: number;
  application_id: number | null;
  appointment_type: AppointmentType;
  scheduled_start: Date;
  scheduled_end: Date;
  status: AppointmentStatus;
  meeting_url: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationRecord {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  data_json: Record<string, any> | null;
  read_at: Date | null;
  created_at: Date;
}

export interface AuditLogRecord {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}
