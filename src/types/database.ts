export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: Shop
        Insert: Partial<Shop>
        Update: Partial<Shop>
      }
      barbers: {
        Row: Barber
        Insert: Partial<Barber>
        Update: Partial<Barber>
      }
      tickets: {
        Row: Ticket
        Insert: Partial<Ticket>
        Update: Partial<Ticket>
      }
    }
    Functions: {
      get_next_ticket_number: {
        Args: { p_shop_id: string }
        Returns: number
      }
      process_next_customer: {
        Args: { p_barber_id: string; p_shop_id: string }
        Returns: {
          ticket_id: string
          ticket_number: number
          customer_name: string
          people_count: number
        }[]
      }
    }
  }
}

export interface Shop {
  id: string
  owner_id: string
  slug: string
  name: string
  logo_url: string | null
  maps_url: string | null
  phone: string | null
  is_open: boolean
  created_at: string
}

export interface Barber {
  id: string
  shop_id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Ticket {
  id: string
  shop_id: string
  barber_id: string | null
  customer_name: string
  phone_number: string
  people_count: number
  ticket_number: number
  user_session_id: string
  status: 'waiting' | 'serving' | 'completed' | 'canceled'
  created_at: string
  updated_at: string
}
