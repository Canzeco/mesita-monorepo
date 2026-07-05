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
  public: {
    Tables: {
      account_invites: {
        Row: {
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          created_by: string;
          email: string;
          expires_at: string;
          id: string;
          project_id: string;
          role: Database["public"]["Enums"]["member_role"];
          token: string;
        };
        Insert: {
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by: string;
          email: string;
          expires_at?: string;
          id?: string;
          project_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          token: string;
        };
        Update: {
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_invites_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          created_at: string;
          email: string | null;
          first_name: string | null;
          full_name: string | null;
          id: string;
          last_name: string | null;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id: string;
          last_name?: string | null;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          atlas_analyze_google_images: number;
          atlas_analyze_instagram_images: number;
          atlas_analyze_website_images: number;
          atlas_gather_google_images: number;
          atlas_gather_instagram_posts: number;
          atlas_gather_website_images: number;
          atlas_image_analysis_prompt: string;
          atlas_image_sorting_prompt: string;
          atlas_image_vision_enabled: boolean;
          atlas_per_run_cost_cap_usd: number;
          atlas_save_total_images: number;
          atlas_synthesis_quality: string;
          atlas_vision_quality: string;
          atlas_website_crawl_max_pages: number;
          auto_verify_ai_call: boolean;
          auto_verify_ai_email: boolean;
          auto_verify_video: boolean;
          id: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          atlas_analyze_google_images?: number;
          atlas_analyze_instagram_images?: number;
          atlas_analyze_website_images?: number;
          atlas_gather_google_images?: number;
          atlas_gather_instagram_posts?: number;
          atlas_gather_website_images?: number;
          atlas_image_analysis_prompt?: string;
          atlas_image_sorting_prompt?: string;
          atlas_image_vision_enabled?: boolean;
          atlas_per_run_cost_cap_usd?: number;
          atlas_save_total_images?: number;
          atlas_synthesis_quality?: string;
          atlas_vision_quality?: string;
          atlas_website_crawl_max_pages?: number;
          auto_verify_ai_call?: boolean;
          auto_verify_ai_email?: boolean;
          auto_verify_video?: boolean;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          atlas_analyze_google_images?: number;
          atlas_analyze_instagram_images?: number;
          atlas_analyze_website_images?: number;
          atlas_gather_google_images?: number;
          atlas_gather_instagram_posts?: number;
          atlas_gather_website_images?: number;
          atlas_image_analysis_prompt?: string;
          atlas_image_sorting_prompt?: string;
          atlas_image_vision_enabled?: boolean;
          atlas_per_run_cost_cap_usd?: number;
          atlas_save_total_images?: number;
          atlas_synthesis_quality?: string;
          atlas_vision_quality?: string;
          atlas_website_crawl_max_pages?: number;
          auto_verify_ai_call?: boolean;
          auto_verify_ai_email?: boolean;
          auto_verify_video?: boolean;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      business_plans: {
        Row: {
          created_at: string;
          currency: string;
          key: string;
          label: string;
          price_cents: number;
          stripe_price_id: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          key: string;
          label: string;
          price_cents?: number;
          stripe_price_id?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          key?: string;
          label?: string;
          price_cents?: number;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      consumer_code_counter: {
        Row: {
          id: number;
          next_value: number;
        };
        Insert: {
          id?: number;
          next_value?: number;
        };
        Update: {
          id?: number;
          next_value?: number;
        };
        Relationships: [];
      };
      consumer_pay_notifications: {
        Row: {
          consumer_id: string;
          created_at: string;
          id: string;
          kind: string;
          payload: Json;
          resolved_at: string | null;
          status: string;
          ticket_id: string;
        };
        Insert: {
          consumer_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          payload?: Json;
          resolved_at?: string | null;
          status?: string;
          ticket_id: string;
        };
        Update: {
          consumer_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          resolved_at?: string | null;
          status?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consumer_pay_notifications_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consumer_pay_notifications_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      consumer_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          consumer_id: string;
          created_at: string;
          currency: string;
          current_period_end: string | null;
          id: string;
          price_cents: number | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          consumer_id: string;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          id?: string;
          price_cents?: number | null;
          status: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          consumer_id?: string;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          id?: string;
          price_cents?: number | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consumer_subscriptions_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
        ];
      };
      consumers: {
        Row: {
          avatar_url: string | null;
          birthday: string | null;
          code: string | null;
          consumer_instagram_followers_count: number | null;
          country: string | null;
          created_at: string;
          first_name: string | null;
          full_name: string | null;
          id: string;
          last_name: string | null;
          phone: string | null;
          sex: string | null;
          class_expires_at: string | null;
          class_granted_at: string | null;
          class_key: string;
          class_origin: string;
        };
        Insert: {
          avatar_url?: string | null;
          birthday?: string | null;
          code?: string | null;
          consumer_instagram_followers_count?: number | null;
          country?: string | null;
          created_at?: string;
          first_name?: string | null;
          full_name?: string | null;
          id: string;
          last_name?: string | null;
          phone?: string | null;
          sex?: string | null;
          class_expires_at?: string | null;
          class_granted_at?: string | null;
          class_key?: string;
          class_origin?: string;
        };
        Update: {
          avatar_url?: string | null;
          birthday?: string | null;
          code?: string | null;
          consumer_instagram_followers_count?: number | null;
          country?: string | null;
          created_at?: string;
          first_name?: string | null;
          full_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone?: string | null;
          sex?: string | null;
          class_expires_at?: string | null;
          class_granted_at?: string | null;
          class_key?: string;
          class_origin?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consumers_class_key_fkey";
            columns: ["class_key"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["key"];
          },
        ];
      };
      coupons: {
        Row: {
          cancelled_at: string | null;
          cap_cents: number;
          consumer_id: string;
          created_at: string;
          currency: string;
          expires_at: string | null;
          free_rate: number | null;
          id: string;
          issued_at: string;
          premium_rate: number | null;
          project_id: string;
          redeemed_at: string | null;
          saved_place_id: string | null;
          status: Database["public"]["Enums"]["coupon_status"];
          updated_at: string;
          welcome_free_rate: number | null;
          welcome_premium_rate: number | null;
        };
        Insert: {
          cancelled_at?: string | null;
          cap_cents?: number;
          consumer_id: string;
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          free_rate?: number | null;
          id?: string;
          issued_at?: string;
          premium_rate?: number | null;
          project_id: string;
          redeemed_at?: string | null;
          saved_place_id?: string | null;
          status?: Database["public"]["Enums"]["coupon_status"];
          updated_at?: string;
          welcome_free_rate?: number | null;
          welcome_premium_rate?: number | null;
        };
        Update: {
          cancelled_at?: string | null;
          cap_cents?: number;
          consumer_id?: string;
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          free_rate?: number | null;
          id?: string;
          issued_at?: string;
          premium_rate?: number | null;
          project_id?: string;
          redeemed_at?: string | null;
          saved_place_id?: string | null;
          status?: Database["public"]["Enums"]["coupon_status"];
          updated_at?: string;
          welcome_free_rate?: number | null;
          welcome_premium_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "coupons_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupons_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupons_saved_place_id_fkey";
            columns: ["saved_place_id"];
            isOneToOne: false;
            referencedRelation: "saved_places";
            referencedColumns: ["id"];
          },
        ];
      };
      place_categories: {
        Row: {
          created_at: string;
          label: string;
          section: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          label: string;
          section: string;
          slug: string;
          sort_order: number;
        };
        Update: {
          created_at?: string;
          label?: string;
          section?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      place_enrichment_events: {
        Row: {
          created_at: string;
          detail: string | null;
          id: string;
          meta: Json;
          project_id: string;
          status: string;
          step: string;
          step_name: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          meta?: Json;
          project_id: string;
          status?: string;
          step: string;
          step_name: string;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          meta?: Json;
          project_id?: string;
          status?: string;
          step?: string;
          step_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_enrichment_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_enrichment_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_view";
            referencedColumns: ["id"];
          },
        ];
      };
      place_media_assets: {
        Row: {
          analysis_text: string | null;
          bytes: number | null;
          caption: string | null;
          created_at: string;
          id: string;
          last_error: string | null;
          likes_count: number | null;
          mime_type: string | null;
          project_id: string;
          public_url: string | null;
          source: string;
          source_metadata: Json | null;
          source_url: string;
          status: string;
          storage_path: string | null;
          updated_at: string;
        };
        Insert: {
          analysis_text?: string | null;
          bytes?: number | null;
          caption?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          likes_count?: number | null;
          mime_type?: string | null;
          project_id: string;
          public_url?: string | null;
          source: string;
          source_metadata?: Json | null;
          source_url: string;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          analysis_text?: string | null;
          bytes?: number | null;
          caption?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          likes_count?: number | null;
          mime_type?: string | null;
          project_id?: string;
          public_url?: string | null;
          source?: string;
          source_metadata?: Json | null;
          source_url?: string;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_media_assets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      place_tags: {
        Row: {
          created_at: string;
          facet: string;
          label_en: string;
          label_es: string;
          section: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          facet: string;
          label_en: string;
          label_es: string;
          section: string;
          slug: string;
          sort_order: number;
        };
        Update: {
          created_at?: string;
          facet?: string;
          label_en?: string;
          label_es?: string;
          section?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      places: {
        Row: {
          address: string | null;
          category: string | null;
          category_label: string | null;
          city: string | null;
          closes_at: string | null;
          country: string | null;
          created_at: string;
          description: string | null;
          details: Json | null;
          didi_food_url: string | null;
          editorial_summary: string | null;
          email: string | null;
          embedding: string | null;
          embedding_source_hash: string | null;
          enriched_at: string | null;
          enrichment_sources: Json | null;
          established_year: number | null;
          executive_chef: string | null;
          facebook_followers: number | null;
          facebook_rating: number | null;
          facebook_url: string | null;
          google_business_url: string | null;
          google_maps_url: string | null;
          google_place_id: string | null;
          google_review_count: number | null;
          google_reviews: Json | null;
          google_stars_overall: number | null;
          google_visitor_count: number | null;
          hours: Json | null;
          id: string;
          instagram_followers_count: number | null;
          instagram_pr_urls: string[];
          instagram_url: string | null;
          lat: number | null;
          lng: number | null;
          menu_pdf_name: string | null;
          menu_pdf_url: string | null;
          menus: Json | null;
          mesita_review_count: number | null;
          mesita_stars_ambience: number | null;
          mesita_stars_food: number | null;
          mesita_stars_overall: number | null;
          mesita_stars_service: number | null;
          mesita_stars_value: number | null;
          mesita_visitor_count: number | null;
          name: string;
          opentable_url: string | null;
          phone: string | null;
          photos: string[];
          pitch: string | null;
          popular_times: Json | null;
          price_level: number | null;
          products: Json | null;
          reddit_url: string | null;
          resy_url: string | null;
          story: string | null;
          tags: string[];
          threads_url: string | null;
          tiktok_url: string | null;
          timezone: string | null;
          tripadvisor_url: string | null;
          uber_eats_url: string | null;
          updated_at: string;
          vibe: string | null;
          website_url: string | null;
          whatsapp_pr_urls: string[];
          whatsapp_url: string | null;
          x_url: string | null;
          yelp_url: string | null;
          zone: string | null;
        };
        Insert: {
          address?: string | null;
          category?: string | null;
          category_label?: string | null;
          city?: string | null;
          closes_at?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          details?: Json | null;
          didi_food_url?: string | null;
          editorial_summary?: string | null;
          email?: string | null;
          embedding?: string | null;
          embedding_source_hash?: string | null;
          enriched_at?: string | null;
          enrichment_sources?: Json | null;
          established_year?: number | null;
          executive_chef?: string | null;
          facebook_followers?: number | null;
          facebook_rating?: number | null;
          facebook_url?: string | null;
          google_business_url?: string | null;
          google_maps_url?: string | null;
          google_place_id?: string | null;
          google_review_count?: number | null;
          google_reviews?: Json | null;
          google_stars_overall?: number | null;
          google_visitor_count?: number | null;
          hours?: Json | null;
          id?: string;
          instagram_followers_count?: number | null;
          instagram_pr_urls?: string[];
          instagram_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          menu_pdf_name?: string | null;
          menu_pdf_url?: string | null;
          menus?: Json | null;
          mesita_review_count?: number | null;
          mesita_stars_ambience?: number | null;
          mesita_stars_food?: number | null;
          mesita_stars_overall?: number | null;
          mesita_stars_service?: number | null;
          mesita_stars_value?: number | null;
          mesita_visitor_count?: number | null;
          name: string;
          opentable_url?: string | null;
          phone?: string | null;
          photos?: string[];
          pitch?: string | null;
          popular_times?: Json | null;
          price_level?: number | null;
          products?: Json | null;
          reddit_url?: string | null;
          resy_url?: string | null;
          story?: string | null;
          tags?: string[];
          threads_url?: string | null;
          tiktok_url?: string | null;
          timezone?: string | null;
          tripadvisor_url?: string | null;
          uber_eats_url?: string | null;
          updated_at?: string;
          vibe?: string | null;
          website_url?: string | null;
          whatsapp_pr_urls?: string[];
          whatsapp_url?: string | null;
          x_url?: string | null;
          yelp_url?: string | null;
          zone?: string | null;
        };
        Update: {
          address?: string | null;
          category?: string | null;
          category_label?: string | null;
          city?: string | null;
          closes_at?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          details?: Json | null;
          didi_food_url?: string | null;
          editorial_summary?: string | null;
          email?: string | null;
          embedding?: string | null;
          embedding_source_hash?: string | null;
          enriched_at?: string | null;
          enrichment_sources?: Json | null;
          established_year?: number | null;
          executive_chef?: string | null;
          facebook_followers?: number | null;
          facebook_rating?: number | null;
          facebook_url?: string | null;
          google_business_url?: string | null;
          google_maps_url?: string | null;
          google_place_id?: string | null;
          google_review_count?: number | null;
          google_reviews?: Json | null;
          google_stars_overall?: number | null;
          google_visitor_count?: number | null;
          hours?: Json | null;
          id?: string;
          instagram_followers_count?: number | null;
          instagram_pr_urls?: string[];
          instagram_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          menu_pdf_name?: string | null;
          menu_pdf_url?: string | null;
          menus?: Json | null;
          mesita_review_count?: number | null;
          mesita_stars_ambience?: number | null;
          mesita_stars_food?: number | null;
          mesita_stars_overall?: number | null;
          mesita_stars_service?: number | null;
          mesita_stars_value?: number | null;
          mesita_visitor_count?: number | null;
          name?: string;
          opentable_url?: string | null;
          phone?: string | null;
          photos?: string[];
          pitch?: string | null;
          popular_times?: Json | null;
          price_level?: number | null;
          products?: Json | null;
          reddit_url?: string | null;
          resy_url?: string | null;
          story?: string | null;
          tags?: string[];
          threads_url?: string | null;
          tiktok_url?: string | null;
          timezone?: string | null;
          tripadvisor_url?: string | null;
          uber_eats_url?: string | null;
          updated_at?: string;
          vibe?: string | null;
          website_url?: string | null;
          whatsapp_pr_urls?: string[];
          whatsapp_url?: string | null;
          x_url?: string | null;
          yelp_url?: string | null;
          zone?: string | null;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          created_at: string;
          currency: string;
          follower_threshold: number | null;
          key: string;
          label: string;
          monthly_reservation_limit: number | null;
          price_cents: number;
          rank: number;
          recommendation_weight: number;
          stripe_price_id: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          follower_threshold?: number | null;
          key: string;
          label: string;
          monthly_reservation_limit?: number | null;
          price_cents?: number;
          rank: number;
          recommendation_weight?: number;
          stripe_price_id?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          follower_threshold?: number | null;
          key?: string;
          label?: string;
          monthly_reservation_limit?: number | null;
          price_cents?: number;
          rank?: number;
          recommendation_weight?: number;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          project_id: string;
          role: Database["public"]["Enums"]["member_role"];
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          project_id: string;
          role?: Database["public"]["Enums"]["member_role"];
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
        };
        Relationships: [
          {
            foreignKeyName: "project_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_roles: {
        Row: {
          created_at: string;
          invited_by: string | null;
          project_id: string;
          role: Database["public"]["Enums"]["project_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          invited_by?: string | null;
          project_id: string;
          role: Database["public"]["Enums"]["project_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string | null;
          project_id?: string;
          role?: Database["public"]["Enums"]["project_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_roles_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          currency: string;
          current_period_end: string | null;
          id: string;
          plan_key: string;
          price_cents: number | null;
          project_id: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          id?: string;
          plan_key: string;
          price_cents?: number | null;
          project_id: string;
          status: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          id?: string;
          plan_key?: string;
          price_cents?: number | null;
          project_id?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_subscriptions_plan_key_fkey";
            columns: ["plan_key"];
            isOneToOne: false;
            referencedRelation: "business_plans";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "project_subscriptions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_verifications: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decided_via: string | null;
          id: string;
          method: Database["public"]["Enums"]["verification_method"];
          payload: Json;
          project_id: string;
          reject_reason: string | null;
          requester_email: string;
          requester_id: string;
          status: Database["public"]["Enums"]["verification_status"];
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decided_via?: string | null;
          id?: string;
          method: Database["public"]["Enums"]["verification_method"];
          payload?: Json;
          project_id: string;
          reject_reason?: string | null;
          requester_email: string;
          requester_id: string;
          status?: Database["public"]["Enums"]["verification_status"];
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decided_via?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["verification_method"];
          payload?: Json;
          project_id?: string;
          reject_reason?: string | null;
          requester_email?: string;
          requester_id?: string;
          status?: Database["public"]["Enums"]["verification_status"];
        };
        Relationships: [
          {
            foreignKeyName: "project_verifications_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          content_status: Database["public"]["Enums"]["content_gen_status"];
          created_at: string;
          currency: string;
          fiscal_type: Database["public"]["Enums"]["project_fiscal_type"];
          free_rate: number | null;
          id: string;
          listing_type: Database["public"]["Enums"]["listing_type"];
          monthly_promo_cap: number | null;
          plan: Database["public"]["Enums"]["membership"];
          premium_rate: number | null;
          requires_story: boolean;
          reward_cap_cents: number | null;
          segmentation_advanced_enabled: boolean;
          segmentation_basic_enabled: boolean;
          slug: string;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
          welcome_free_rate: number | null;
          welcome_premium_rate: number | null;
        };
        Insert: {
          content_status?: Database["public"]["Enums"]["content_gen_status"];
          created_at?: string;
          currency?: string;
          fiscal_type?: Database["public"]["Enums"]["project_fiscal_type"];
          free_rate?: number | null;
          id: string;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          monthly_promo_cap?: number | null;
          plan?: Database["public"]["Enums"]["membership"];
          premium_rate?: number | null;
          requires_story?: boolean;
          reward_cap_cents?: number | null;
          segmentation_advanced_enabled?: boolean;
          segmentation_basic_enabled?: boolean;
          slug: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          welcome_free_rate?: number | null;
          welcome_premium_rate?: number | null;
        };
        Update: {
          content_status?: Database["public"]["Enums"]["content_gen_status"];
          created_at?: string;
          currency?: string;
          fiscal_type?: Database["public"]["Enums"]["project_fiscal_type"];
          free_rate?: number | null;
          id?: string;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          monthly_promo_cap?: number | null;
          plan?: Database["public"]["Enums"]["membership"];
          premium_rate?: number | null;
          requires_story?: boolean;
          reward_cap_cents?: number | null;
          segmentation_advanced_enabled?: boolean;
          segmentation_basic_enabled?: boolean;
          slug?: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          welcome_free_rate?: number | null;
          welcome_premium_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "units_place_fk";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "units_place_fk";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "projects_view";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          cancelled_at: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          consumer_id: string;
          coupon_id: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          party_size: number;
          project_id: string;
          reserved_at: string;
          status: Database["public"]["Enums"]["reservation_status"];
          updated_at: string;
        };
        Insert: {
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          consumer_id: string;
          coupon_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          party_size: number;
          project_id: string;
          reserved_at: string;
          status?: Database["public"]["Enums"]["reservation_status"];
          updated_at?: string;
        };
        Update: {
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          consumer_id?: string;
          coupon_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          party_size?: number;
          project_id?: string;
          reserved_at?: string;
          status?: Database["public"]["Enums"]["reservation_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_places: {
        Row: {
          consumer_id: string;
          created_at: string;
          id: string;
          project_id: string;
        };
        Insert: {
          consumer_id: string;
          created_at?: string;
          id?: string;
          project_id: string;
        };
        Update: {
          consumer_id?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_places_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_places_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_project_creations: {
        Row: {
          attempts: number;
          created_at: string;
          created_by: string | null;
          error: string | null;
          exec_at: string;
          id: string;
          net_request_id: number | null;
          place_id: string;
          result: Json | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          exec_at?: string;
          id?: string;
          net_request_id?: number | null;
          place_id: string;
          result?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          exec_at?: string;
          id?: string;
          net_request_id?: number | null;
          place_id?: string;
          result?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_invites: {
        Row: {
          channel: string;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          phone: string | null;
          project_id: string;
          token: string;
        };
        Insert: {
          channel?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          phone?: string | null;
          project_id: string;
          token: string;
        };
        Update: {
          channel?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          phone?: string | null;
          project_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_invites_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_whatsapp_messages: {
        Row: {
          body: string;
          created_at: string;
          direction: string;
          id: string;
          phone_e164: string;
          twilio_message_sid: string | null;
        };
        Insert: {
          body: string;
          created_at?: string;
          direction: string;
          id?: string;
          phone_e164: string;
          twilio_message_sid?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          direction?: string;
          id?: string;
          phone_e164?: string;
          twilio_message_sid?: string | null;
        };
        Relationships: [];
      };
      staff_whatsapp_sessions: {
        Row: {
          consumer_id: string | null;
          context: Json;
          created_at: string;
          id: string;
          pending_consumer_code: string | null;
          phone_e164: string;
          project_id: string | null;
          staff_user_id: string;
          state: string;
          ticket_id: string | null;
          updated_at: string;
        };
        Insert: {
          consumer_id?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          pending_consumer_code?: string | null;
          phone_e164: string;
          project_id?: string | null;
          staff_user_id: string;
          state?: string;
          ticket_id?: string | null;
          updated_at?: string;
        };
        Update: {
          consumer_id?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          pending_consumer_code?: string | null;
          phone_e164?: string;
          project_id?: string | null;
          staff_user_id?: string;
          state?: string;
          ticket_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_whatsapp_sessions_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_whatsapp_sessions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_whatsapp_sessions_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          event_id: string;
          processed_at: string;
        };
        Insert: {
          event_id: string;
          processed_at?: string;
        };
        Update: {
          event_id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      super_admins: {
        Row: {
          added_by: string | null;
          created_at: string;
          email: string;
          note: string | null;
          user_id: string | null;
        };
        Insert: {
          added_by?: string | null;
          created_at?: string;
          email: string;
          note?: string | null;
          user_id?: string | null;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          email?: string;
          note?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ticket_reviews: {
        Row: {
          ambiance: number;
          comments: string | null;
          consumer_id: string;
          created_at: string;
          food: number;
          id: string;
          overall: number;
          project_id: string;
          service: number;
          ticket_id: string;
          value: number | null;
        };
        Insert: {
          ambiance: number;
          comments?: string | null;
          consumer_id: string;
          created_at?: string;
          food: number;
          id?: string;
          overall: number;
          project_id: string;
          service: number;
          ticket_id: string;
          value?: number | null;
        };
        Update: {
          ambiance?: number;
          comments?: string | null;
          consumer_id?: string;
          created_at?: string;
          food?: number;
          id?: string;
          overall?: number;
          project_id?: string;
          service?: number;
          ticket_id?: string;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_reviews_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_reviews_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: true;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          check_subtotal_cents: number | null;
          consumer_id: string;
          created_at: string;
          currency: string;
          discount_cents: number | null;
          discount_percent: number | null;
          id: string;
          kind: Database["public"]["Enums"]["ticket_kind"];
          opened_by: string;
          opened_by_staff_user_id: string | null;
          paid_at: string | null;
          project_id: string;
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
        };
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          check_subtotal_cents?: number | null;
          consumer_id: string;
          created_at?: string;
          currency?: string;
          discount_cents?: number | null;
          discount_percent?: number | null;
          id?: string;
          kind?: Database["public"]["Enums"]["ticket_kind"];
          opened_by: string;
          opened_by_staff_user_id?: string | null;
          paid_at?: string | null;
          project_id: string;
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
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          check_subtotal_cents?: number | null;
          consumer_id?: string;
          created_at?: string;
          currency?: string;
          discount_cents?: number | null;
          discount_percent?: number | null;
          id?: string;
          kind?: Database["public"]["Enums"]["ticket_kind"];
          opened_by?: string;
          opened_by_staff_user_id?: string | null;
          paid_at?: string | null;
          project_id?: string;
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
        };
        Relationships: [
          {
            foreignKeyName: "tickets_consumer_id_fkey";
            columns: ["consumer_id"];
            isOneToOne: false;
            referencedRelation: "consumers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_story_verified_by_fkey";
            columns: ["story_verified_by"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      projects_view: {
        Row: {
          address: string | null;
          category: string | null;
          category_label: string | null;
          city: string | null;
          closes_at: string | null;
          content_status:
            | Database["public"]["Enums"]["content_gen_status"]
            | null;
          country: string | null;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          details: Json | null;
          didi_food_url: string | null;
          editorial_summary: string | null;
          email: string | null;
          embedding: string | null;
          embedding_source_hash: string | null;
          enriched_at: string | null;
          enrichment_sources: Json | null;
          established_year: number | null;
          executive_chef: string | null;
          facebook_followers: number | null;
          facebook_rating: number | null;
          facebook_url: string | null;
          fiscal_type:
            | Database["public"]["Enums"]["project_fiscal_type"]
            | null;
          free_rate: number | null;
          google_business_url: string | null;
          google_maps_url: string | null;
          google_place_id: string | null;
          google_review_count: number | null;
          google_reviews: Json | null;
          google_stars_overall: number | null;
          google_visitor_count: number | null;
          hours: Json | null;
          id: string | null;
          instagram_followers_count: number | null;
          instagram_pr_urls: string[] | null;
          instagram_url: string | null;
          lat: number | null;
          listing_type: Database["public"]["Enums"]["listing_type"] | null;
          lng: number | null;
          menu_pdf_name: string | null;
          menu_pdf_url: string | null;
          menus: Json | null;
          mesita_review_count: number | null;
          mesita_stars_ambience: number | null;
          mesita_stars_food: number | null;
          mesita_stars_overall: number | null;
          mesita_stars_service: number | null;
          mesita_stars_value: number | null;
          mesita_visitor_count: number | null;
          monthly_promo_cap: number | null;
          name: string | null;
          opentable_url: string | null;
          phone: string | null;
          photos: string[] | null;
          pitch: string | null;
          plan: Database["public"]["Enums"]["membership"] | null;
          popular_times: Json | null;
          premium_rate: number | null;
          price_level: number | null;
          products: Json | null;
          reddit_url: string | null;
          requires_story: boolean | null;
          resy_url: string | null;
          reward_cap_cents: number | null;
          segmentation_advanced_enabled: boolean | null;
          segmentation_basic_enabled: boolean | null;
          slug: string | null;
          status: Database["public"]["Enums"]["project_status"] | null;
          story: string | null;
          tags: string[] | null;
          threads_url: string | null;
          tiktok_url: string | null;
          timezone: string | null;
          tripadvisor_url: string | null;
          uber_eats_url: string | null;
          updated_at: string | null;
          vibe: string | null;
          website_url: string | null;
          welcome_free_rate: number | null;
          welcome_premium_rate: number | null;
          whatsapp_pr_urls: string[] | null;
          whatsapp_url: string | null;
          x_url: string | null;
          yelp_url: string | null;
          zone: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_reset_database: { Args: never; Returns: Json };
      admin_revoke_admin: { Args: { p_email: string }; Returns: number };
      find_user_id_by_phone: {
        Args: { phone_digits: string };
        Returns: string;
      };
      generate_consumer_code: { Args: never; Returns: string };
      run_scheduled_project_creations: { Args: never; Returns: number };
      seed_place_categories: { Args: never; Returns: undefined };
      seed_place_tags: { Args: never; Returns: undefined };
    };
    Enums: {
      content_gen_status: "queued" | "generating" | "ready" | "failed";
      coupon_status: "active" | "redeemed" | "expired" | "cancelled";
      listing_type: "partner" | "web" | "unclaimed";
      member_role: "owner" | "editor" | "viewer";
      membership: "free" | "pro" | "ultra";
      project_fiscal_type: "formal" | "informal";
      project_role: "staff" | "business";
      project_status:
        | "lead"
        | "active"
        | "paused"
        | "archived"
        | "pending_review"
        | "pending_verification";
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
        | "staff_verified"
        | "staff_rejected";
      ticket_kind: "reservation" | "coupon";
      ticket_status:
        | "open"
        | "pending_payment"
        | "paid"
        | "cancelled"
        | "revealed"
        | "awaiting_story"
        | "awaiting_payment_confirm";
      verification_method:
        | "ai_call"
        | "video"
        | "postcard"
        | "ai_email"
        | "manual_contact";
      verification_status: "pending" | "approved" | "rejected";
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
  public: {
    Enums: {
      content_gen_status: ["queued", "generating", "ready", "failed"],
      coupon_status: ["active", "redeemed", "expired", "cancelled"],
      listing_type: ["partner", "web", "unclaimed"],
      member_role: ["owner", "editor", "viewer"],
      membership: ["free", "pro", "ultra"],
      project_fiscal_type: ["formal", "informal"],
      project_role: ["staff", "business"],
      project_status: [
        "lead",
        "active",
        "paused",
        "archived",
        "pending_review",
        "pending_verification",
      ],
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
        "staff_verified",
        "staff_rejected",
      ],
      ticket_kind: ["reservation", "coupon"],
      ticket_status: [
        "open",
        "pending_payment",
        "paid",
        "cancelled",
        "revealed",
        "awaiting_story",
        "awaiting_payment_confirm",
      ],
      verification_method: [
        "ai_call",
        "video",
        "postcard",
        "ai_email",
        "manual_contact",
      ],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const;
