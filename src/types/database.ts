import type {
  AppUserRole,
  ClosingCorrectionStatus,
  ContentStatus,
  PaymentLedgerPaymentMethod,
  PaymentLedgerSourceType,
  PaymentLedgerStatus,
  PaymentMethod,
  PaymentStatus,
  ProductSaleStatus,
  ProductStatus,
  RegisterClosingStatus,
  ReservationStatus,
  SaleRefundPaymentMethod,
  SaleRefundStatus,
  SlotStatus,
  StaffStatus,
  UserRole,
} from "@/types/domain";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type {
  AppUserRole,
  ClosingCorrectionStatus,
  ContentStatus,
  PaymentMethod,
  PaymentStatus,
  ProductSaleStatus,
  ProductStatus,
  RegisterClosingStatus,
  ReservationStatus,
  SaleRefundPaymentMethod,
  SaleRefundStatus,
  SlotStatus,
  UserRole,
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_admin_assignments: {
        Row: {
          user_id: string;
          business_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          business_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          business_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          address: string | null;
          prefecture: string | null;
          capacity: number;
          is_active: boolean;
          image_url: string | null;
          business_id: string | null;
          category: string;
          booking_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          address?: string | null;
          prefecture?: string | null;
          capacity?: number;
          is_active?: boolean;
          image_url?: string | null;
          business_id?: string | null;
          category?: string;
          booking_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          address?: string | null;
          prefecture?: string | null;
          capacity?: number;
          is_active?: boolean;
          image_url?: string | null;
          business_id?: string | null;
          category?: string;
          booking_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      location_weekly_hours: {
        Row: {
          id: string;
          location_id: string;
          day_of_week: number;
          is_open: boolean;
          open_time: string | null;
          close_time: string | null;
          is_24_hours: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          day_of_week: number;
          is_open?: boolean;
          open_time?: string | null;
          close_time?: string | null;
          is_24_hours?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          day_of_week?: number;
          is_open?: boolean;
          open_time?: string | null;
          close_time?: string | null;
          is_24_hours?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_weekly_hours_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      location_date_exceptions: {
        Row: {
          id: string;
          location_id: string;
          exception_date: string;
          is_open: boolean;
          open_time: string | null;
          close_time: string | null;
          is_24_hours: boolean;
          note: string | null;
          ignore_weekly_breaks: boolean;
          tag_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          exception_date: string;
          is_open?: boolean;
          open_time?: string | null;
          close_time?: string | null;
          is_24_hours?: boolean;
          note?: string | null;
          ignore_weekly_breaks?: boolean;
          tag_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          exception_date?: string;
          is_open?: boolean;
          open_time?: string | null;
          close_time?: string | null;
          is_24_hours?: boolean;
          note?: string | null;
          ignore_weekly_breaks?: boolean;
          tag_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_date_exceptions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      location_weekly_breaks: {
        Row: {
          id: string;
          location_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_weekly_breaks_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      location_exception_breaks: {
        Row: {
          id: string;
          date_exception_id: string;
          start_time: string;
          end_time: string;
          label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date_exception_id: string;
          start_time: string;
          end_time: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date_exception_id?: string;
          start_time?: string;
          end_time?: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_exception_breaks_date_exception_id_fkey";
            columns: ["date_exception_id"];
            isOneToOne: false;
            referencedRelation: "location_date_exceptions";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          duration_minutes: number;
          price_yen: number;
          is_active: boolean;
          location_id: string | null;
          description: string | null;
          max_guests: number;
          is_visible: boolean;
          is_accepting_reservations: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          duration_minutes: number;
          price_yen: number;
          is_active?: boolean;
          location_id?: string | null;
          description?: string | null;
          max_guests?: number;
          is_visible?: boolean;
          is_accepting_reservations?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          duration_minutes?: number;
          price_yen?: number;
          is_active?: boolean;
          location_id?: string | null;
          description?: string | null;
          max_guests?: number;
          is_visible?: boolean;
          is_accepting_reservations?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_slots: {
        Row: {
          id: string;
          spot_id: string;
          slot_date: string;
          start_time: string;
          end_time: string;
          max_capacity: number;
          booked_count: number;
          status: SlotStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          slot_date: string;
          start_time: string;
          end_time: string;
          max_capacity?: number;
          booked_count?: number;
          status?: SlotStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          spot_id?: string;
          slot_date?: string;
          start_time?: string;
          end_time?: string;
          max_capacity?: number;
          booked_count?: number;
          status?: SlotStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          user_id: string;
          spot_id: string;
          plan_id: string;
          slot_id: string;
          reservation_date: string;
          start_time: string;
          end_time: string;
          guest_count: number;
          total_amount_yen: number;
          status: ReservationStatus;
          payment_method: PaymentMethod;
          stripe_checkout_session_id: string | null;
          expires_at: string | null;
          expired_email_sent_at: string | null;
          reserved_plan_name: string | null;
          reserved_unit_price_yen: number | null;
          reserved_duration_minutes: number | null;
          tax_rate_percent: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spot_id: string;
          plan_id: string;
          slot_id: string;
          reservation_date: string;
          start_time: string;
          end_time: string;
          guest_count?: number;
          total_amount_yen: number;
          status?: ReservationStatus;
          payment_method?: PaymentMethod;
          stripe_checkout_session_id?: string | null;
          expires_at?: string | null;
          expired_email_sent_at?: string | null;
          reserved_plan_name?: string | null;
          reserved_unit_price_yen?: number | null;
          reserved_duration_minutes?: number | null;
          tax_rate_percent?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spot_id?: string;
          plan_id?: string;
          slot_id?: string;
          reservation_date?: string;
          start_time?: string;
          end_time?: string;
          guest_count?: number;
          total_amount_yen?: number;
          status?: ReservationStatus;
          payment_method?: PaymentMethod;
          stripe_checkout_session_id?: string | null;
          expires_at?: string | null;
          expired_email_sent_at?: string | null;
          reserved_plan_name?: string | null;
          reserved_unit_price_yen?: number | null;
          reserved_duration_minutes?: number | null;
          tax_rate_percent?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          reservation_id: string;
          stripe_payment_intent_id: string | null;
          stripe_checkout_session_id: string | null;
          amount_yen: number;
          currency: string;
          status: PaymentStatus;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
          amount_yen: number;
          currency?: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
          amount_yen?: number;
          currency?: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tax_rates: {
        Row: {
          id: string;
          rate_percent: number;
          valid_from: string;
          valid_until: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rate_percent: number;
          valid_from: string;
          valid_until?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rate_percent?: number;
          valid_from?: string;
          valid_until?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          id: string;
          payment_id: string;
          reservation_id: string;
          amount_yen: number;
          tax_rate_percent: number;
          reason: string;
          refund_type: "full" | "partial";
          stripe_refund_id: string | null;
          refunded_by: string;
          refunded_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          reservation_id: string;
          amount_yen: number;
          tax_rate_percent: number;
          reason: string;
          refund_type: "full" | "partial";
          stripe_refund_id?: string | null;
          refunded_by: string;
          refunded_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          reservation_id?: string;
          amount_yen?: number;
          tax_rate_percent?: number;
          reason?: string;
          refund_type?: "full" | "partial";
          stripe_refund_id?: string | null;
          refunded_by?: string;
          refunded_at?: string;
        };
        Relationships: [];
      };
      manual_sales: {
        Row: {
          id: string;
          business_id: string;
          location_id: string | null;
          sale_date: string;
          amount_yen: number;
          tax_rate_percent: number;
          category: "bait" | "rental" | "parking" | "food" | "event" | "other";
          payment_method: "cash" | "card" | "qr" | "other";
          description: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          location_id?: string | null;
          sale_date: string;
          amount_yen: number;
          tax_rate_percent: number;
          category: "bait" | "rental" | "parking" | "food" | "event" | "other";
          payment_method: "cash" | "card" | "qr" | "other";
          description?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          location_id?: string | null;
          sale_date?: string;
          amount_yen?: number;
          tax_rate_percent?: number;
          category?: "bait" | "rental" | "parking" | "food" | "event" | "other";
          payment_method?: "cash" | "card" | "qr" | "other";
          description?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          price_excluding_tax: number;
          stock_quantity: number | null;
          image_url: string | null;
          status: ProductStatus;
          default_tax_rate: number;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          price_excluding_tax: number;
          stock_quantity?: number | null;
          image_url?: string | null;
          status?: ProductStatus;
          default_tax_rate?: number;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          price_excluding_tax?: number;
          stock_quantity?: number | null;
          image_url?: string | null;
          status?: ProductStatus;
          default_tax_rate?: number;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_sales: {
        Row: {
          id: string;
          business_id: string;
          product_id: string;
          quantity: number;
          unit_price_excluding_tax: number;
          tax_rate_percent: number;
          payment_method: "stripe" | "cash" | "credit_card" | "e_money" | "qr" | "other";
          status: ProductSaleStatus;
          recorded_by: string;
          purchased_at: string;
          sale_session_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          product_id: string;
          quantity: number;
          unit_price_excluding_tax: number;
          tax_rate_percent: number;
          payment_method: "stripe" | "cash" | "credit_card" | "e_money" | "qr" | "other";
          status?: ProductSaleStatus;
          recorded_by: string;
          purchased_at?: string;
          sale_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price_excluding_tax?: number;
          tax_rate_percent?: number;
          payment_method?: "stripe" | "cash" | "credit_card" | "e_money" | "qr" | "other";
          status?: ProductSaleStatus;
          recorded_by?: string;
          purchased_at?: string;
          sale_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sale_sessions: {
        Row: {
          id: string;
          business_id: string;
          sold_at: string;
          payment_method: "cash" | "stripe" | "credit_card" | "e_money" | "qr" | "other";
          tax_rate_percent: number;
          subtotal_amount: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          note: string | null;
          payment_other_label: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          sold_at?: string;
          payment_method: "cash" | "stripe" | "credit_card" | "e_money" | "qr" | "other";
          tax_rate_percent: number;
          subtotal_amount: number;
          discount_amount?: number;
          tax_amount: number;
          total_amount: number;
          note?: string | null;
          payment_other_label?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          sold_at?: string;
          payment_method?: "cash" | "stripe" | "credit_card" | "e_money" | "qr" | "other";
          tax_rate_percent?: number;
          subtotal_amount?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          note?: string | null;
          payment_other_label?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sale_session_items: {
        Row: {
          id: string;
          sale_session_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          tax_rate_percent: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_session_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          tax_rate_percent?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_session_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          tax_rate_percent?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      sale_session_discounts: {
        Row: {
          id: string;
          sale_session_id: string;
          discount_type: "amount" | "rate";
          target: "item" | "session";
          target_item_id: string | null;
          discount_value: number;
          discount_amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_session_id: string;
          discount_type: "amount" | "rate";
          target: "item" | "session";
          target_item_id?: string | null;
          discount_value: number;
          discount_amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_session_id?: string;
          discount_type?: "amount" | "rate";
          target?: "item" | "session";
          target_item_id?: string | null;
          discount_value?: number;
          discount_amount?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      catch_reports: {
        Row: {
          id: string;
          spot_id: string;
          author_id: string;
          title: string;
          fish_species: string | null;
          weight_kg: number | null;
          length_cm: number | null;
          description: string | null;
          image_url: string | null;
          caught_date: string | null;
          status: ContentStatus;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          author_id: string;
          title: string;
          fish_species?: string | null;
          weight_kg?: number | null;
          length_cm?: number | null;
          description?: string | null;
          image_url?: string | null;
          caught_date?: string | null;
          status?: ContentStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          spot_id?: string;
          author_id?: string;
          title?: string;
          fish_species?: string | null;
          weight_kg?: number | null;
          length_cm?: number | null;
          description?: string | null;
          image_url?: string | null;
          caught_date?: string | null;
          status?: ContentStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          content: string;
          cover_image_url: string | null;
          status: ContentStatus;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          content: string;
          cover_image_url?: string | null;
          status?: ContentStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          slug?: string;
          excerpt?: string | null;
          content?: string;
          cover_image_url?: string | null;
          status?: ContentStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          email: string;
          name: string | null;
          role: string;
          status: StaffStatus;
          invited_at: string | null;
          joined_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          email: string;
          name?: string | null;
          role?: string;
          status?: StaffStatus;
          invited_at?: string | null;
          joined_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string | null;
          email?: string;
          name?: string | null;
          role?: string;
          status?: StaffStatus;
          invited_at?: string | null;
          joined_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      register_closings: {
        Row: {
          id: string;
          business_id: string;
          location_id: string | null;
          closed_by: string;
          closed_at: string;
          period_start: string;
          period_end: string;
          total_cash: number;
          total_card: number;
          total_other: number;
          total_amount: number;
          post_close_refund_cash: number;
          post_close_refund_card: number;
          post_close_refund_other: number;
          post_close_refund_total: number;
          note: string | null;
          status: RegisterClosingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          location_id?: string | null;
          closed_by: string;
          closed_at?: string;
          period_start: string;
          period_end: string;
          total_cash?: number;
          total_card?: number;
          total_other?: number;
          total_amount?: number;
          post_close_refund_cash?: number;
          post_close_refund_card?: number;
          post_close_refund_other?: number;
          post_close_refund_total?: number;
          note?: string | null;
          status?: RegisterClosingStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          location_id?: string | null;
          closed_by?: string;
          closed_at?: string;
          period_start?: string;
          period_end?: string;
          total_cash?: number;
          total_card?: number;
          total_other?: number;
          total_amount?: number;
          post_close_refund_cash?: number;
          post_close_refund_card?: number;
          post_close_refund_other?: number;
          post_close_refund_total?: number;
          note?: string | null;
          status?: RegisterClosingStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      sale_refunds: {
        Row: {
          id: string;
          business_id: string;
          sale_session_id: string | null;
          reservation_id: string | null;
          stripe_refund_id: string | null;
          stripe_payment_intent_id: string | null;
          amount: number;
          payment_method: SaleRefundPaymentMethod;
          reason: string | null;
          refunded_by: string;
          refunded_at: string;
          status: SaleRefundStatus;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          sale_session_id?: string | null;
          reservation_id?: string | null;
          stripe_refund_id?: string | null;
          stripe_payment_intent_id?: string | null;
          amount: number;
          payment_method: SaleRefundPaymentMethod;
          reason?: string | null;
          refunded_by: string;
          refunded_at?: string;
          status?: SaleRefundStatus;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          sale_session_id?: string | null;
          reservation_id?: string | null;
          stripe_refund_id?: string | null;
          stripe_payment_intent_id?: string | null;
          amount?: number;
          payment_method?: SaleRefundPaymentMethod;
          reason?: string | null;
          refunded_by?: string;
          refunded_at?: string;
          status?: SaleRefundStatus;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      register_closing_corrections: {
        Row: {
          id: string;
          closing_id: string;
          requested_by: string;
          requested_at: string;
          reason: string;
          approved_by: string | null;
          approved_at: string | null;
          status: ClosingCorrectionStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          closing_id: string;
          requested_by: string;
          requested_at?: string;
          reason: string;
          approved_by?: string | null;
          approved_at?: string | null;
          status?: ClosingCorrectionStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          closing_id?: string;
          requested_by?: string;
          requested_at?: string;
          reason?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          status?: ClosingCorrectionStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_ledger: {
        Row: {
          id: string;
          business_id: string;
          source_type: PaymentLedgerSourceType;
          source_id: string;
          amount: number;
          payment_method: PaymentLedgerPaymentMethod;
          status: PaymentLedgerStatus;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          source_type: PaymentLedgerSourceType;
          source_id: string;
          amount: number;
          payment_method: PaymentLedgerPaymentMethod;
          status?: PaymentLedgerStatus;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          source_type?: PaymentLedgerSourceType;
          source_id?: string;
          amount?: number;
          payment_method?: PaymentLedgerPaymentMethod;
          status?: PaymentLedgerStatus;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_reservation_atomic: {
        Args: {
          p_user_id: string;
          p_spot_id: string;
          p_plan_id: string;
          p_slot_id: string;
          p_reservation_date: string;
          p_start_time: string;
          p_end_time: string;
          p_guest_count: number;
          p_total_amount_yen: number;
          p_expires_at: string;
          p_affected_slot_ids: string[];
        };
        Returns: {
          reservation_id: string | null;
          success: boolean;
          error_code: string | null;
          error_message: string | null;
        }[];
      };
      cancel_reservation_atomic: {
        Args: {
          p_reservation_id: string;
          p_user_id: string;
          p_affected_slot_ids: string[];
          p_guest_count: number;
        };
        Returns: {
          reservation_id: string | null;
          success: boolean;
          error_code: string | null;
          error_message: string | null;
        }[];
      };
      expire_pending_reservations: {
        Args: Record<string, never>;
        Returns: {
          expired_count: number;
          reservation_ids: string[];
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type LocationWeeklyHour =
  Database["public"]["Tables"]["location_weekly_hours"]["Row"];
export type LocationDateException =
  Database["public"]["Tables"]["location_date_exceptions"]["Row"];
export type DateExceptionTagType =
  | "closed"
  | "temporary_closed"
  | "special_open"
  | "short_hours"
  | "event"
  | "maintenance"
  | "other";
export type LocationWeeklyBreak =
  Database["public"]["Tables"]["location_weekly_breaks"]["Row"];
export type LocationExceptionBreak =
  Database["public"]["Tables"]["location_exception_breaks"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type AvailabilitySlot = Database["public"]["Tables"]["availability_slots"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type TaxRate = Database["public"]["Tables"]["tax_rates"]["Row"];
export type Refund = Database["public"]["Tables"]["refunds"]["Row"];
export type ManualSale = Database["public"]["Tables"]["manual_sales"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductSale = Database["public"]["Tables"]["product_sales"]["Row"];
export type SaleSession = Database["public"]["Tables"]["sale_sessions"]["Row"];
export type SaleSessionItem = Database["public"]["Tables"]["sale_session_items"]["Row"];
export type StaffMemberRow = Database["public"]["Tables"]["staff_members"]["Row"];
export type SaleSessionDiscount = Database["public"]["Tables"]["sale_session_discounts"]["Row"];
export type PosPaymentMethod = SaleSession["payment_method"];
export type CatchReport = Database["public"]["Tables"]["catch_reports"]["Row"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
export type RegisterClosingRow = Database["public"]["Tables"]["register_closings"]["Row"];
export type RegisterClosingCorrectionRow = Database["public"]["Tables"]["register_closing_corrections"]["Row"];
export type SaleRefundRow = Database["public"]["Tables"]["sale_refunds"]["Row"];
export type PaymentLedgerRow = Database["public"]["Tables"]["payment_ledger"]["Row"];
