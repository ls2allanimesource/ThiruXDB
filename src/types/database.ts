export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ApiEndpoint {
  id: string;
  name: string;
  description: string | null;
  base_url: string;
  auth_type: 'none' | 'api_key' | 'bearer' | 'basic';
  auth_config: Json;
  field_mappings: Json;
  response_path: string;
  pagination_type: 'none' | 'offset' | 'cursor' | 'page';
  pagination_config: Json;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRecord {
  id: string;
  endpoint_id: string;
  external_id: string | null;
  raw_data: Json;
  mapped_data: Json;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface FetchLog {
  id: string;
  endpoint_id: string;
  status: 'success' | 'error' | 'partial';
  records_fetched: number;
  records_created: number;
  records_updated: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: 'string' | 'number' | 'boolean' | 'date';
}

export interface EndpointFormData {
  name: string;
  description: string;
  base_url: string;
  auth_type: 'none' | 'api_key' | 'bearer' | 'basic';
  auth_config: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    username?: string;
    password?: string;
  };
  field_mappings: FieldMapping[];
  response_path: string;
  pagination_type: 'none' | 'offset' | 'cursor' | 'page';
  pagination_config: {
    limit_param?: string;
    offset_param?: string;
    page_param?: string;
    cursor_param?: string;
    default_limit?: number;
  };
  is_active: boolean;
}
