import type {
  AppUserRole,
  ContentStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  SlotStatus,
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
  ContentStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
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
export type CatchReport = Database["public"]["Tables"]["catch_reports"]["Row"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
