export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      cashback_ledger: {
        Row: {
          balance_after_cents: number;
          created_at: string;
          delta_cents: number;
          guest_id: string;
          id: string;
          kind: Database["public"]["Enums"]["cashback_kind"];
          notes: string | null;
          ticket_id: string | null;
          venue_id: string | null;
        };
        Insert: {
          balance_after_cents: number;
          created_at?: string;
          delta_cents: number;
          guest_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["cashback_kind"];
          notes?: string | null;
          ticket_id?: string | null;
          venue_id?: string | null;
        };
        Update: {
          balance_after_cents?: number;
          created_at?: string;
          delta_cents?: number;
          guest_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["cashback_kind"];
          notes?: string | null;
          ticket_id?: string | null;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cashback_ledger_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cashback_ledger_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cashback_ledger_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      guests: {
        Row: {
          avatar_url: string | null;
          birthday: string | null;
          cashback_balance_cents: number;
          code: string | null;
          country: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          sex: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          birthday?: string | null;
          cashback_balance_cents?: number;
          code?: string | null;
          country?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          sex?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          birthday?: string | null;
          cashback_balance_cents?: number;
          code?: string | null;
          country?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          sex?: string | null;
        };
        Relationships: [];
      };
      managers: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cashback_cents: number | null;
          cashback_percent: number;
          check_subtotal_cents: number | null;
          created_at: string;
          currency: string;
          discount_cents: number | null;
          discount_percent: number | null;
          guest_id: string;
          id: string;
          kind: Database["public"]["Enums"]["ticket_kind"];
          opened_by: string;
          paid_at: string | null;
          redeem_cents: number | null;
          reservation_at: string | null;
          reservation_channel: string | null;
          reservation_notes: string | null;
          reservation_party_size: number | null;
          reservation_status:
            | Database["public"]["Enums"]["reservation_status"]
            | null;
          revealed_at: string | null;
          status: Database["public"]["Enums"]["ticket_status"];
          story_reject_reason: string | null;
          story_screenshot_url: string | null;
          story_status: Database["public"]["Enums"]["story_status"];
          story_submitted_at: string | null;
          story_verified_at: string | null;
          story_verified_by: string | null;
          tip_cents: number | null;
          total_cents: number | null;
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cashback_cents?: number | null;
          cashback_percent: number;
          check_subtotal_cents?: number | null;
          created_at?: string;
          currency?: string;
          discount_cents?: number | null;
          discount_percent?: number | null;
          guest_id: string;
          id?: string;
          kind?: Database["public"]["Enums"]["ticket_kind"];
          opened_by: string;
          paid_at?: string | null;
          redeem_cents?: number | null;
          reservation_at?: string | null;
          reservation_channel?: string | null;
          reservation_notes?: string | null;
          reservation_party_size?: number | null;
          reservation_status?:
            | Database["public"]["Enums"]["reservation_status"]
            | null;
          revealed_at?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          story_reject_reason?: string | null;
          story_screenshot_url?: string | null;
          story_status?: Database["public"]["Enums"]["story_status"];
          story_submitted_at?: string | null;
          story_verified_at?: string | null;
          story_verified_by?: string | null;
          tip_cents?: number | null;
          total_cents?: number | null;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cashback_cents?: number | null;
          cashback_percent?: number;
          check_subtotal_cents?: number | null;
          created_at?: string;
          currency?: string;
          discount_cents?: number | null;
          discount_percent?: number | null;
          guest_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["ticket_kind"];
          opened_by?: string;
          paid_at?: string | null;
          redeem_cents?: number | null;
          reservation_at?: string | null;
          reservation_channel?: string | null;
          reservation_notes?: string | null;
          reservation_party_size?: number | null;
          reservation_status?:
            | Database["public"]["Enums"]["reservation_status"]
            | null;
          revealed_at?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          story_reject_reason?: string | null;
          story_screenshot_url?: string | null;
          story_status?: Database["public"]["Enums"]["story_status"];
          story_submitted_at?: string | null;
          story_verified_at?: string | null;
          story_verified_by?: string | null;
          tip_cents?: number | null;
          total_cents?: number | null;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_story_verified_by_fkey";
            columns: ["story_verified_by"];
            isOneToOne: false;
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_members: {
        Row: {
          created_at: string;
          id: string;
          manager_id: string;
          role: Database["public"]["Enums"]["member_role"];
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          manager_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          venue_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          manager_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_members_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_members_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          address: string | null;
          cashback_percent: number | null;
          category: string | null;
          closes_at: string | null;
          created_at: string;
          facebook_url: string | null;
          fiscal_type: Database["public"]["Enums"]["venue_fiscal_type"];
          google_place_id: string | null;
          id: string;
          instagram_url: string | null;
          lat: number | null;
          listing_type: Database["public"]["Enums"]["listing_type"];
          lng: number | null;
          name: string;
          opentable_url: string | null;
          phone: string | null;
          photos: string[];
          pitch: string | null;
          price_level: number | null;
          rappi_url: string | null;
          resy_url: string | null;
          slug: string;
          status: Database["public"]["Enums"]["venue_status"];
          story: string | null;
          tiktok_url: string | null;
          timezone: string | null;
          uber_eats_url: string | null;
          updated_at: string;
          vibe: string | null;
          website_url: string | null;
          whatsapp_url: string | null;
        };
        Insert: {
          address?: string | null;
          cashback_percent?: number | null;
          category?: string | null;
          closes_at?: string | null;
          created_at?: string;
          facebook_url?: string | null;
          fiscal_type?: Database["public"]["Enums"]["venue_fiscal_type"];
          google_place_id?: string | null;
          id?: string;
          instagram_url?: string | null;
          lat?: number | null;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          lng?: number | null;
          name: string;
          opentable_url?: string | null;
          phone?: string | null;
          photos?: string[];
          pitch?: string | null;
          price_level?: number | null;
          rappi_url?: string | null;
          resy_url?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["venue_status"];
          story?: string | null;
          tiktok_url?: string | null;
          timezone?: string | null;
          uber_eats_url?: string | null;
          updated_at?: string;
          vibe?: string | null;
          website_url?: string | null;
          whatsapp_url?: string | null;
        };
        Update: {
          address?: string | null;
          cashback_percent?: number | null;
          category?: string | null;
          closes_at?: string | null;
          created_at?: string;
          facebook_url?: string | null;
          fiscal_type?: Database["public"]["Enums"]["venue_fiscal_type"];
          google_place_id?: string | null;
          id?: string;
          instagram_url?: string | null;
          lat?: number | null;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          lng?: number | null;
          name?: string;
          opentable_url?: string | null;
          phone?: string | null;
          photos?: string[];
          pitch?: string | null;
          price_level?: number | null;
          rappi_url?: string | null;
          resy_url?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["venue_status"];
          story?: string | null;
          tiktok_url?: string | null;
          timezone?: string | null;
          uber_eats_url?: string | null;
          updated_at?: string;
          vibe?: string | null;
          website_url?: string | null;
          whatsapp_url?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_guest_code: { Args: never; Returns: string };
    };
    Enums: {
      cashback_kind: "earn" | "redeem" | "expire" | "adjust";
      listing_type: "partner" | "web";
      member_role: "owner" | "manager" | "staff";
      reservation_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "no_show"
        | "cancelled";
      story_status:
        | "not_required"
        | "pending"
        | "submitted"
        | "ai_verified"
        | "ai_rejected"
        | "waiter_verified"
        | "waiter_rejected";
      ticket_kind:
        | "none"
        | "p_c"
        | "s_p_sf_c"
        | "r_p_c"
        | "r_s_p_sf_c"
        | "dp"
        | "s_dp_sf"
        | "r_dp"
        | "r_s_dp_sf";
      ticket_status:
        | "open"
        | "pending_pay"
        | "paid"
        | "cancelled"
        | "revealed"
        | "awaiting_story";
      venue_fiscal_type: "formal" | "informal";
      venue_status: "lead" | "active" | "paused" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cashback_kind: ["earn", "redeem", "expire", "adjust"],
      listing_type: ["partner", "web"],
      member_role: ["owner", "manager", "staff"],
      reservation_status: [
        "pending",
        "confirmed",
        "declined",
        "no_show",
        "cancelled",
      ],
      story_status: [
        "not_required",
        "pending",
        "submitted",
        "ai_verified",
        "ai_rejected",
        "waiter_verified",
        "waiter_rejected",
      ],
      ticket_kind: [
        "none",
        "p_c",
        "s_p_sf_c",
        "r_p_c",
        "r_s_p_sf_c",
        "dp",
        "s_dp_sf",
        "r_dp",
        "r_s_dp_sf",
      ],
      ticket_status: [
        "open",
        "pending_pay",
        "paid",
        "cancelled",
        "revealed",
        "awaiting_story",
      ],
      venue_fiscal_type: ["formal", "informal"],
      venue_status: ["lead", "active", "paused", "archived"],
    },
  },
} as const;
