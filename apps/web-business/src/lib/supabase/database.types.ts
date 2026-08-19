export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_reset_preserve: {
        Row: {
          reason: string
          table_name: string
        }
        Insert: {
          reason: string
          table_name: string
        }
        Update: {
          reason?: string
          table_name?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          agents_config: Json
          atlas_analyze_google_images: number
          atlas_analyze_instagram_images: number
          atlas_discover_facebook_n: number
          atlas_discover_instagram_n: number
          atlas_discover_opentable_n: number
          atlas_discover_ubereats_n: number
          atlas_discover_website_n: number
          atlas_gather_google_images: number
          atlas_gather_instagram_depth: number
          atlas_gather_instagram_posts: number
          atlas_gather_reviews: number
          atlas_image_analysis_prompt: string
          atlas_image_sorting_prompt: string
          atlas_image_vision_enabled: boolean
          atlas_per_run_cost_cap_usd: number
          atlas_perplexity_preset: string
          atlas_save_images_to_storage: boolean
          atlas_save_total_images: number
          atlas_synthesis_quality: string
          atlas_vision_quality: string
          auto_verify_ai_call: boolean
          auto_verify_ai_email: boolean
          auto_verify_video: boolean
          create_places_as_verified: boolean
          filters_config: Json | null
          id: number
          memo_greeting: string
          memo_instructions: string
          memo_openai_model: string
          memo_perplexity_model: string
          memo_provider: string
          memo_web_grounding: boolean
          models_config: Json
          ojo_config: Json | null
          promos_config: Json
          reservations_config: Json
          sourcing_config: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agents_config?: Json
          atlas_analyze_google_images?: number
          atlas_analyze_instagram_images?: number
          atlas_discover_facebook_n?: number
          atlas_discover_instagram_n?: number
          atlas_discover_opentable_n?: number
          atlas_discover_ubereats_n?: number
          atlas_discover_website_n?: number
          atlas_gather_google_images?: number
          atlas_gather_instagram_depth?: number
          atlas_gather_instagram_posts?: number
          atlas_gather_reviews?: number
          atlas_image_analysis_prompt?: string
          atlas_image_sorting_prompt?: string
          atlas_image_vision_enabled?: boolean
          atlas_per_run_cost_cap_usd?: number
          atlas_perplexity_preset?: string
          atlas_save_images_to_storage?: boolean
          atlas_save_total_images?: number
          atlas_synthesis_quality?: string
          atlas_vision_quality?: string
          auto_verify_ai_call?: boolean
          auto_verify_ai_email?: boolean
          auto_verify_video?: boolean
          create_places_as_verified?: boolean
          filters_config?: Json | null
          id?: number
          memo_greeting?: string
          memo_instructions?: string
          memo_openai_model?: string
          memo_perplexity_model?: string
          memo_provider?: string
          memo_web_grounding?: boolean
          models_config?: Json
          ojo_config?: Json | null
          promos_config?: Json
          reservations_config?: Json
          sourcing_config?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agents_config?: Json
          atlas_analyze_google_images?: number
          atlas_analyze_instagram_images?: number
          atlas_discover_facebook_n?: number
          atlas_discover_instagram_n?: number
          atlas_discover_opentable_n?: number
          atlas_discover_ubereats_n?: number
          atlas_discover_website_n?: number
          atlas_gather_google_images?: number
          atlas_gather_instagram_depth?: number
          atlas_gather_instagram_posts?: number
          atlas_gather_reviews?: number
          atlas_image_analysis_prompt?: string
          atlas_image_sorting_prompt?: string
          atlas_image_vision_enabled?: boolean
          atlas_per_run_cost_cap_usd?: number
          atlas_perplexity_preset?: string
          atlas_save_images_to_storage?: boolean
          atlas_save_total_images?: number
          atlas_synthesis_quality?: string
          atlas_vision_quality?: string
          auto_verify_ai_call?: boolean
          auto_verify_ai_email?: boolean
          auto_verify_video?: boolean
          create_places_as_verified?: boolean
          filters_config?: Json | null
          id?: number
          memo_greeting?: string
          memo_instructions?: string
          memo_openai_model?: string
          memo_perplexity_model?: string
          memo_provider?: string
          memo_web_grounding?: boolean
          models_config?: Json
          ojo_config?: Json | null
          promos_config?: Json
          reservations_config?: Json
          sourcing_config?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          follower_threshold: number | null
          key: string
          label: string
          monthly_reservation_limit: number | null
          rank: number
          recommendation_weight: number
        }
        Insert: {
          created_at?: string
          follower_threshold?: number | null
          key: string
          label: string
          monthly_reservation_limit?: number | null
          rank: number
          recommendation_weight?: number
        }
        Update: {
          created_at?: string
          follower_threshold?: number | null
          key?: string
          label?: string
          monthly_reservation_limit?: number | null
          rank?: number
          recommendation_weight?: number
        }
        Relationships: []
      }
      consumer_code_counter: {
        Row: {
          id: number
          next_value: number
        }
        Insert: {
          id?: number
          next_value?: number
        }
        Update: {
          id?: number
          next_value?: number
        }
        Relationships: []
      }
      consumer_connectors: {
        Row: {
          consumer_id: string
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_connectors_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_notifications: {
        Row: {
          consumer_id: string
          created_at: string
          id: string
          kind: string
          payload: Json
          resolved_at: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          resolved_at?: string | null
          status?: string
          ticket_id: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          resolved_at?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_notifications_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "visit_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_plans: {
        Row: {
          created_at: string
          currency: string
          key: string
          label: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          key: string
          label: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          key?: string
          label?: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      consumer_review_claims: {
        Row: {
          consumer_id: string
          created_at: string
          project_id: string
          ticket_id: string | null
        }
        Insert: {
          consumer_id: string
          created_at?: string
          project_id: string
          ticket_id?: string | null
        }
        Update: {
          consumer_id?: string
          created_at?: string
          project_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumer_review_claims_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_review_claims_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_review_claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "visit_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          consumer_id: string
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          price_cents: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          consumer_id: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          price_cents?: number | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          consumer_id?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          price_cents?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_subscriptions_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      consumers: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          class_expires_at: string | null
          class_granted_at: string | null
          class_key: string
          class_origin: string
          code: string | null
          country: string | null
          created_at: string
          first_name: string | null
          full_name: string | null
          id: string
          instagram_followers_count: number | null
          instagram_handle: string | null
          invitation_class_key: string | null
          invitation_granted_at: string | null
          last_name: string | null
          phone: string | null
          privacy_public: boolean
          privacy_show_saves: boolean
          privacy_show_stories: boolean
          privacy_show_visits: boolean
          sex: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          class_expires_at?: string | null
          class_granted_at?: string | null
          class_key?: string
          class_origin?: string
          code?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id: string
          instagram_followers_count?: number | null
          instagram_handle?: string | null
          invitation_class_key?: string | null
          invitation_granted_at?: string | null
          last_name?: string | null
          phone?: string | null
          privacy_public?: boolean
          privacy_show_saves?: boolean
          privacy_show_stories?: boolean
          privacy_show_visits?: boolean
          sex?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          class_expires_at?: string | null
          class_granted_at?: string | null
          class_key?: string
          class_origin?: string
          code?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          instagram_followers_count?: number | null
          instagram_handle?: string | null
          invitation_class_key?: string | null
          invitation_granted_at?: string | null
          last_name?: string | null
          phone?: string | null
          privacy_public?: boolean
          privacy_show_saves?: boolean
          privacy_show_stories?: boolean
          privacy_show_visits?: boolean
          sex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumers_invitation_class_key_fkey"
            columns: ["invitation_class_key"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "consumers_tier_key_fkey"
            columns: ["class_key"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["key"]
          },
        ]
      }
      favorites: {
        Row: {
          consumer_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      place_categories: {
        Row: {
          created_at: string
          label: string
          section: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          label: string
          section: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          label?: string
          section?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      place_creation_attempts: {
        Row: {
          caller: string
          consumer_id: string
          created_at: string
          google_place_id: string
          id: number
        }
        Insert: {
          caller: string
          consumer_id: string
          created_at?: string
          google_place_id: string
          id?: never
        }
        Update: {
          caller?: string
          consumer_id?: string
          created_at?: string
          google_place_id?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "place_creation_attempts_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      place_enrichment_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          meta: Json
          place_id: string
          status: string
          step: string
          step_name: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          meta?: Json
          place_id: string
          status?: string
          step: string
          step_name: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          meta?: Json
          place_id?: string
          status?: string
          step?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_enrichment_events_project_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_enrichment_events_project_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_media_assets: {
        Row: {
          analysis_text: string | null
          bytes: number | null
          caption: string | null
          created_at: string
          id: string
          last_error: string | null
          likes_count: number | null
          mime_type: string | null
          place_id: string
          public_url: string | null
          source: string
          source_metadata: Json | null
          source_url: string
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          analysis_text?: string | null
          bytes?: number | null
          caption?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          likes_count?: number | null
          mime_type?: string | null
          place_id: string
          public_url?: string | null
          source: string
          source_metadata?: Json | null
          source_url: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          analysis_text?: string | null
          bytes?: number | null
          caption?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          likes_count?: number | null
          mime_type?: string | null
          place_id?: string
          public_url?: string | null
          source?: string
          source_metadata?: Json | null
          source_url?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_media_assets_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_media_assets_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_research: {
        Row: {
          analysis: Json | null
          attempts: number
          created_at: string
          created_by: string | null
          error: string | null
          gathered: Json | null
          google_place_id: string
          place_id: string
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          analysis?: Json | null
          attempts?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          gathered?: Json | null
          google_place_id: string
          place_id: string
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          analysis?: Json | null
          attempts?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          gathered?: Json | null
          google_place_id?: string
          place_id?: string
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_research_project_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_research_project_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_tags: {
        Row: {
          created_at: string
          facet: string
          label_en: string
          label_es: string
          section: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          facet: string
          label_en: string
          label_es: string
          section: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          facet?: string
          label_en?: string
          label_es?: string
          section?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          category: string | null
          category_label: string | null
          city: string | null
          closes_at: string | null
          country: string | null
          created_at: string
          description: string | null
          description_es: string | null
          details: Json | null
          didi_food_url: string | null
          editorial_summary: string | null
          email: string | null
          embedding: string | null
          embedding_source_hash: string | null
          embedding_source_text: string | null
          enriched_at: string | null
          enrichment_sources: Json | null
          established_year: number | null
          executive_chef: string | null
          facebook_followers: number | null
          facebook_rating: number | null
          facebook_url: string | null
          google_business_url: string | null
          google_maps_url: string | null
          google_name: string | null
          google_place_id: string | null
          google_review_count: number | null
          google_reviews: Json | null
          google_stars_overall: number | null
          google_visitor_count: number | null
          hours: Json | null
          id: string
          instagram_followers_count: number | null
          instagram_pr_urls: string[]
          instagram_url: string | null
          lat: number | null
          lng: number | null
          manual_priority: number
          menu_pdf_name: string | null
          menu_pdf_url: string | null
          menus: Json | null
          mesita_name: string | null
          mesita_review_count: number | null
          mesita_stars_ambience: number | null
          mesita_stars_food: number | null
          mesita_stars_overall: number | null
          mesita_stars_service: number | null
          mesita_stars_value: number | null
          mesita_visitor_count: number | null
          name: string
          opentable_url: string | null
          phone: string | null
          photos: string[]
          pitch: string | null
          popular_times: Json | null
          price_level: number | null
          products: Json | null
          reddit_url: string | null
          reservation_contacts: Json
          reservation_endpoint: string | null
          resy_url: string | null
          story: string | null
          tags: string[]
          threads_url: string | null
          tiktok_url: string | null
          timezone: string | null
          tripadvisor_url: string | null
          uber_eats_url: string | null
          updated_at: string
          vibe: string | null
          website_url: string | null
          whatsapp_pr_urls: string[]
          whatsapp_url: string | null
          x_url: string | null
          yelp_url: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          category_label?: string | null
          city?: string | null
          closes_at?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          description_es?: string | null
          details?: Json | null
          didi_food_url?: string | null
          editorial_summary?: string | null
          email?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          embedding_source_text?: string | null
          enriched_at?: string | null
          enrichment_sources?: Json | null
          established_year?: number | null
          executive_chef?: string | null
          facebook_followers?: number | null
          facebook_rating?: number | null
          facebook_url?: string | null
          google_business_url?: string | null
          google_maps_url?: string | null
          google_name?: string | null
          google_place_id?: string | null
          google_review_count?: number | null
          google_reviews?: Json | null
          google_stars_overall?: number | null
          google_visitor_count?: number | null
          hours?: Json | null
          id?: string
          instagram_followers_count?: number | null
          instagram_pr_urls?: string[]
          instagram_url?: string | null
          lat?: number | null
          lng?: number | null
          manual_priority?: number
          menu_pdf_name?: string | null
          menu_pdf_url?: string | null
          menus?: Json | null
          mesita_name?: string | null
          mesita_review_count?: number | null
          mesita_stars_ambience?: number | null
          mesita_stars_food?: number | null
          mesita_stars_overall?: number | null
          mesita_stars_service?: number | null
          mesita_stars_value?: number | null
          mesita_visitor_count?: number | null
          name?: string
          opentable_url?: string | null
          phone?: string | null
          photos?: string[]
          pitch?: string | null
          popular_times?: Json | null
          price_level?: number | null
          products?: Json | null
          reddit_url?: string | null
          reservation_contacts?: Json
          reservation_endpoint?: string | null
          resy_url?: string | null
          story?: string | null
          tags?: string[]
          threads_url?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          tripadvisor_url?: string | null
          uber_eats_url?: string | null
          updated_at?: string
          vibe?: string | null
          website_url?: string | null
          whatsapp_pr_urls?: string[]
          whatsapp_url?: string | null
          x_url?: string | null
          yelp_url?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          category_label?: string | null
          city?: string | null
          closes_at?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          description_es?: string | null
          details?: Json | null
          didi_food_url?: string | null
          editorial_summary?: string | null
          email?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          embedding_source_text?: string | null
          enriched_at?: string | null
          enrichment_sources?: Json | null
          established_year?: number | null
          executive_chef?: string | null
          facebook_followers?: number | null
          facebook_rating?: number | null
          facebook_url?: string | null
          google_business_url?: string | null
          google_maps_url?: string | null
          google_name?: string | null
          google_place_id?: string | null
          google_review_count?: number | null
          google_reviews?: Json | null
          google_stars_overall?: number | null
          google_visitor_count?: number | null
          hours?: Json | null
          id?: string
          instagram_followers_count?: number | null
          instagram_pr_urls?: string[]
          instagram_url?: string | null
          lat?: number | null
          lng?: number | null
          manual_priority?: number
          menu_pdf_name?: string | null
          menu_pdf_url?: string | null
          menus?: Json | null
          mesita_name?: string | null
          mesita_review_count?: number | null
          mesita_stars_ambience?: number | null
          mesita_stars_food?: number | null
          mesita_stars_overall?: number | null
          mesita_stars_service?: number | null
          mesita_stars_value?: number | null
          mesita_visitor_count?: number | null
          name?: string
          opentable_url?: string | null
          phone?: string | null
          photos?: string[]
          pitch?: string | null
          popular_times?: Json | null
          price_level?: number | null
          products?: Json | null
          reddit_url?: string | null
          reservation_contacts?: Json
          reservation_endpoint?: string | null
          resy_url?: string | null
          story?: string | null
          tags?: string[]
          threads_url?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          tripadvisor_url?: string | null
          uber_eats_url?: string | null
          updated_at?: string
          vibe?: string | null
          website_url?: string | null
          whatsapp_pr_urls?: string[]
          whatsapp_url?: string | null
          x_url?: string | null
          yelp_url?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      project_invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          project_id: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          project_id: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "project_members_business_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_plans: {
        Row: {
          created_at: string
          currency: string
          key: string
          label: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          key: string
          label: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          key?: string
          label?: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      project_strikes: {
        Row: {
          consumer_id: string | null
          created_at: string
          id: string
          notes: string | null
          project_id: string
          reason: string
          strike_number: number
          ticket_id: string | null
        }
        Insert: {
          consumer_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          reason: string
          strike_number: number
          ticket_id?: string | null
        }
        Update: {
          consumer_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          reason?: string
          strike_number?: number
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_strikes_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_strikes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_strikes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "visit_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      project_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          plan_key: string
          price_cents: number | null
          project_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          plan_key: string
          price_cents?: number | null
          project_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string
          price_cents?: number | null
          project_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "project_plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "project_subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_verifications: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_via: string | null
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          payload: Json
          project_id: string
          reject_reason: string | null
          requester_email: string
          requester_id: string
          status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_via?: string | null
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          payload?: Json
          project_id: string
          reject_reason?: string | null
          requester_email: string
          requester_id: string
          status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_via?: string | null
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          payload?: Json
          project_id?: string
          reject_reason?: string | null
          requester_email?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_verifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          check_pin: string | null
          check_require_bill: boolean
          content_status: Database["public"]["Enums"]["content_status"]
          created_at: string
          currency: string
          discount_cap_cents: number | null
          first_ticket_honored_at: string | null
          fiscal_type: Database["public"]["Enums"]["project_fiscal_type"]
          free_rate: number | null
          id: string
          last_strike_at: string | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          monthly_promo_cap: number | null
          plan: Database["public"]["Enums"]["plan"]
          plan_forfeited_at: string | null
          plan_live_at: string | null
          premium_rate: number | null
          promo_paused_until: string | null
          requires_story: boolean
          segmentation_advanced_enabled: boolean
          segmentation_basic_enabled: boolean
          slug: string
          staff_channel_pinged_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          strike_count: number
          updated_at: string
          welcome_free_rate: number | null
          welcome_premium_rate: number | null
        }
        Insert: {
          check_pin?: string | null
          check_require_bill?: boolean
          content_status?: Database["public"]["Enums"]["content_status"]
          created_at?: string
          currency?: string
          discount_cap_cents?: number | null
          first_ticket_honored_at?: string | null
          fiscal_type?: Database["public"]["Enums"]["project_fiscal_type"]
          free_rate?: number | null
          id: string
          last_strike_at?: string | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          monthly_promo_cap?: number | null
          plan?: Database["public"]["Enums"]["plan"]
          plan_forfeited_at?: string | null
          plan_live_at?: string | null
          premium_rate?: number | null
          promo_paused_until?: string | null
          requires_story?: boolean
          segmentation_advanced_enabled?: boolean
          segmentation_basic_enabled?: boolean
          slug: string
          staff_channel_pinged_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          strike_count?: number
          updated_at?: string
          welcome_free_rate?: number | null
          welcome_premium_rate?: number | null
        }
        Update: {
          check_pin?: string | null
          check_require_bill?: boolean
          content_status?: Database["public"]["Enums"]["content_status"]
          created_at?: string
          currency?: string
          discount_cap_cents?: number | null
          first_ticket_honored_at?: string | null
          fiscal_type?: Database["public"]["Enums"]["project_fiscal_type"]
          free_rate?: number | null
          id?: string
          last_strike_at?: string | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          monthly_promo_cap?: number | null
          plan?: Database["public"]["Enums"]["plan"]
          plan_forfeited_at?: string | null
          plan_live_at?: string | null
          premium_rate?: number | null
          promo_paused_until?: string | null
          requires_story?: boolean
          segmentation_advanced_enabled?: boolean
          segmentation_basic_enabled?: boolean
          slug?: string
          staff_channel_pinged_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          strike_count?: number
          updated_at?: string
          welcome_free_rate?: number | null
          welcome_premium_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_place_fk"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_place_fk"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_call_counters: {
        Row: {
          calls: number
          day: string
          project_id: string
        }
        Insert: {
          calls?: number
          day: string
          project_id: string
        }
        Update: {
          calls?: number
          day?: string
          project_id?: string
        }
        Relationships: []
      }
      reservation_tickets: {
        Row: {
          alternatives: Json
          attempts: Json
          attempts_planned: number
          attempts_state: string
          call_attempts: number
          callback_at: string | null
          callback_attempts: number
          callback_conversation_id: string | null
          callback_next_attempt_at: string | null
          callback_state: string
          cancelled_at: string | null
          cancelled_by: string | null
          claimed_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          consumer_confirmed_at: string | null
          consumer_id: string
          consumer_notify: string
          consumer_phone: string | null
          created_at: string
          id: string
          is_test: boolean
          last_call_status: string | null
          last_called_at: string | null
          last_conversation_id: string | null
          modification_of: string | null
          negotiation_rounds: number
          next_attempt_at: string | null
          notes: string | null
          notice_attempts: number
          notice_conversation_id: string | null
          notice_kind: string | null
          notice_next_at: string | null
          notice_state: string
          outage_retries: number
          outcome_note: string | null
          party_size: number
          place_phone: string | null
          project_id: string
          reference_code: string | null
          reported_verdict: string | null
          reschedules_day: string | null
          reschedules_today: number
          reserved_at: string
          run_id: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          alternatives?: Json
          attempts?: Json
          attempts_planned?: number
          attempts_state?: string
          call_attempts?: number
          callback_at?: string | null
          callback_attempts?: number
          callback_conversation_id?: string | null
          callback_next_attempt_at?: string | null
          callback_state?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          consumer_confirmed_at?: string | null
          consumer_id: string
          consumer_notify?: string
          consumer_phone?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          last_call_status?: string | null
          last_called_at?: string | null
          last_conversation_id?: string | null
          modification_of?: string | null
          negotiation_rounds?: number
          next_attempt_at?: string | null
          notes?: string | null
          notice_attempts?: number
          notice_conversation_id?: string | null
          notice_kind?: string | null
          notice_next_at?: string | null
          notice_state?: string
          outage_retries?: number
          outcome_note?: string | null
          party_size: number
          place_phone?: string | null
          project_id: string
          reference_code?: string | null
          reported_verdict?: string | null
          reschedules_day?: string | null
          reschedules_today?: number
          reserved_at: string
          run_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          alternatives?: Json
          attempts?: Json
          attempts_planned?: number
          attempts_state?: string
          call_attempts?: number
          callback_at?: string | null
          callback_attempts?: number
          callback_conversation_id?: string | null
          callback_next_attempt_at?: string | null
          callback_state?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          consumer_confirmed_at?: string | null
          consumer_id?: string
          consumer_notify?: string
          consumer_phone?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          last_call_status?: string | null
          last_called_at?: string | null
          last_conversation_id?: string | null
          modification_of?: string | null
          negotiation_rounds?: number
          next_attempt_at?: string | null
          notes?: string | null
          notice_attempts?: number
          notice_conversation_id?: string | null
          notice_kind?: string | null
          notice_next_at?: string | null
          notice_state?: string
          outage_retries?: number
          outcome_note?: string | null
          party_size?: number
          place_phone?: string | null
          project_id?: string
          reference_code?: string | null
          reported_verdict?: string | null
          reschedules_day?: string | null
          reschedules_today?: number
          reserved_at?: string
          run_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_tickets_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          note: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          note?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          note?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ticket_check_events: {
        Row: {
          created_at: string
          event: string
          id: string
          ip_hash: string | null
          self_view: boolean
          ticket_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          ip_hash?: string | null
          self_view?: boolean
          ticket_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          ip_hash?: string | null
          self_view?: boolean
          ticket_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_check_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "visit_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_reports: {
        Row: {
          consumer_id: string
          created_at: string
          details: string | null
          id: string
          project_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          details?: string | null
          id?: string
          project_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          ticket_id: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          details?: string | null
          id?: string
          project_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_reports_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_reports_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "visit_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_reviews: {
        Row: {
          ambience: number
          comments: string | null
          consumer_id: string
          created_at: string
          food: number
          id: string
          overall: number
          project_id: string
          service: number
          ticket_id: string
          value: number | null
        }
        Insert: {
          ambience: number
          comments?: string | null
          consumer_id: string
          created_at?: string
          food: number
          id?: string
          overall: number
          project_id: string
          service: number
          ticket_id: string
          value?: number | null
        }
        Update: {
          ambience?: number
          comments?: string | null
          consumer_id?: string
          created_at?: string
          food?: number
          id?: string
          overall?: number
          project_id?: string
          service?: number
          ticket_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_reviews_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_reviews_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "visit_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_tickets: {
        Row: {
          approved_amount_due_cents: number | null
          approved_at: string | null
          approved_discount_cents: number | null
          bill_source: string | null
          bill_subtotal_cents: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          check_code: string | null
          consumer_id: string
          created_at: string
          currency: string
          discount_cents: number | null
          discount_percent: number | null
          first_scanned_at: string | null
          fix_note: string | null
          fix_requested: string | null
          free_rate: number | null
          id: string
          opened_by: string
          paid_at: string | null
          paid_method: string | null
          premium_rate: number | null
          project_id: string
          rates_snapshotted_at: string | null
          redeem_cents: number | null
          revealed_at: string | null
          review_reject_reason: string | null
          review_screenshot_url: string | null
          review_status: Database["public"]["Enums"]["story_status"]
          review_submitted_at: string | null
          review_verified_at: string | null
          review_verified_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          story_reject_reason: string | null
          story_screenshot_url: string | null
          story_status: Database["public"]["Enums"]["story_status"]
          story_submitted_at: string | null
          story_verified_at: string | null
          story_verified_by: string | null
          tip_cents: number | null
          tip_pct: number | null
          total_cents: number | null
          updated_at: string
          validated_at: string | null
          welcome_free_rate: number | null
          welcome_premium_rate: number | null
        }
        Insert: {
          approved_amount_due_cents?: number | null
          approved_at?: string | null
          approved_discount_cents?: number | null
          bill_source?: string | null
          bill_subtotal_cents?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          check_code?: string | null
          consumer_id: string
          created_at?: string
          currency?: string
          discount_cents?: number | null
          discount_percent?: number | null
          first_scanned_at?: string | null
          fix_note?: string | null
          fix_requested?: string | null
          free_rate?: number | null
          id?: string
          opened_by: string
          paid_at?: string | null
          paid_method?: string | null
          premium_rate?: number | null
          project_id: string
          rates_snapshotted_at?: string | null
          redeem_cents?: number | null
          revealed_at?: string | null
          review_reject_reason?: string | null
          review_screenshot_url?: string | null
          review_status?: Database["public"]["Enums"]["story_status"]
          review_submitted_at?: string | null
          review_verified_at?: string | null
          review_verified_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          story_reject_reason?: string | null
          story_screenshot_url?: string | null
          story_status?: Database["public"]["Enums"]["story_status"]
          story_submitted_at?: string | null
          story_verified_at?: string | null
          story_verified_by?: string | null
          tip_cents?: number | null
          tip_pct?: number | null
          total_cents?: number | null
          updated_at?: string
          validated_at?: string | null
          welcome_free_rate?: number | null
          welcome_premium_rate?: number | null
        }
        Update: {
          approved_amount_due_cents?: number | null
          approved_at?: string | null
          approved_discount_cents?: number | null
          bill_source?: string | null
          bill_subtotal_cents?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          check_code?: string | null
          consumer_id?: string
          created_at?: string
          currency?: string
          discount_cents?: number | null
          discount_percent?: number | null
          first_scanned_at?: string | null
          fix_note?: string | null
          fix_requested?: string | null
          free_rate?: number | null
          id?: string
          opened_by?: string
          paid_at?: string | null
          paid_method?: string | null
          premium_rate?: number | null
          project_id?: string
          rates_snapshotted_at?: string | null
          redeem_cents?: number | null
          revealed_at?: string | null
          review_reject_reason?: string | null
          review_screenshot_url?: string | null
          review_status?: Database["public"]["Enums"]["story_status"]
          review_submitted_at?: string | null
          review_verified_at?: string | null
          review_verified_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          story_reject_reason?: string | null
          story_screenshot_url?: string | null
          story_status?: Database["public"]["Enums"]["story_status"]
          story_submitted_at?: string | null
          story_verified_at?: string | null
          story_verified_by?: string | null
          tip_cents?: number | null
          tip_pct?: number | null
          total_cents?: number | null
          updated_at?: string
          validated_at?: string | null
          welcome_free_rate?: number | null
          welcome_premium_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_tickets_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tickets_story_verified_by_fkey"
            columns: ["story_verified_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles: {
        Row: {
          address: string | null
          category: string | null
          category_label: string | null
          city: string | null
          closes_at: string | null
          content_status: Database["public"]["Enums"]["content_status"] | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          description_es: string | null
          details: Json | null
          didi_food_url: string | null
          discount_cap_cents: number | null
          editorial_summary: string | null
          email: string | null
          embedding: string | null
          embedding_source_hash: string | null
          embedding_source_text: string | null
          enriched_at: string | null
          enrichment_sources: Json | null
          established_year: number | null
          executive_chef: string | null
          facebook_followers: number | null
          facebook_rating: number | null
          facebook_url: string | null
          first_ticket_honored_at: string | null
          fiscal_type: Database["public"]["Enums"]["project_fiscal_type"] | null
          free_rate: number | null
          google_business_url: string | null
          google_maps_url: string | null
          google_name: string | null
          google_place_id: string | null
          google_review_count: number | null
          google_reviews: Json | null
          google_stars_overall: number | null
          google_visitor_count: number | null
          hours: Json | null
          id: string | null
          instagram_followers_count: number | null
          instagram_pr_urls: string[] | null
          instagram_url: string | null
          last_strike_at: string | null
          lat: number | null
          listing_type: Database["public"]["Enums"]["listing_type"] | null
          lng: number | null
          manual_priority: number | null
          menu_pdf_name: string | null
          menu_pdf_url: string | null
          menus: Json | null
          mesita_name: string | null
          mesita_review_count: number | null
          mesita_stars_ambience: number | null
          mesita_stars_food: number | null
          mesita_stars_overall: number | null
          mesita_stars_service: number | null
          mesita_stars_value: number | null
          mesita_visitor_count: number | null
          monthly_promo_cap: number | null
          name: string | null
          opentable_url: string | null
          phone: string | null
          photos: string[] | null
          pitch: string | null
          plan: Database["public"]["Enums"]["plan"] | null
          plan_forfeited_at: string | null
          plan_live_at: string | null
          popular_times: Json | null
          premium_rate: number | null
          price_level: number | null
          products: Json | null
          promo_paused_until: string | null
          reddit_url: string | null
          requires_story: boolean | null
          reservation_contacts: Json | null
          reservation_endpoint: string | null
          resy_url: string | null
          segmentation_advanced_enabled: boolean | null
          segmentation_basic_enabled: boolean | null
          slug: string | null
          staff_channel_pinged_at: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          story: string | null
          strike_count: number | null
          tags: string[] | null
          threads_url: string | null
          tiktok_url: string | null
          timezone: string | null
          tripadvisor_url: string | null
          uber_eats_url: string | null
          updated_at: string | null
          vibe: string | null
          website_url: string | null
          welcome_free_rate: number | null
          welcome_premium_rate: number | null
          whatsapp_pr_urls: string[] | null
          whatsapp_url: string | null
          x_url: string | null
          yelp_url: string | null
          zone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_reset_database: { Args: never; Returns: Json }
      admin_reset_storage_count: {
        Args: { p_keep_buckets?: string[] }
        Returns: number
      }
      admin_reset_storage_paths: {
        Args: { p_keep_buckets?: string[]; p_limit?: number }
        Returns: {
          bucket_id: string
          name: string
        }[]
      }
      admin_revoke_admin: { Args: { p_email: string }; Returns: number }
      bump_reservation_call_counter: { Args: { pid: string }; Returns: number }
      find_user_id_by_phone: { Args: { phone_digits: string }; Returns: string }
      generate_consumer_code: { Args: never; Returns: string }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      refresh_place_mesita_reviews: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      run_place_enrichment_stages: { Args: never; Returns: number }
      seed_place_categories: { Args: never; Returns: undefined }
      seed_place_tags: { Args: never; Returns: undefined }
      service_elevenlabs_api_key: { Args: never; Returns: string }
    }
    Enums: {
      content_status: "queued" | "generating" | "ready" | "failed"
      coupon_status: "active" | "redeemed" | "expired" | "cancelled"
      listing_type: "partner" | "web" | "unclaimed"
      member_role: "owner" | "editor" | "viewer"
      plan: "free" | "pro" | "ultra"
      project_fiscal_type: "formal" | "informal"
      project_status:
        | "lead"
        | "active"
        | "paused"
        | "archived"
        | "pending_review"
        | "pending_verification"
      reservation_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "no_show"
        | "cancelled"
        | "unreachable"
        | "unresolved"
      story_status:
        | "not_required"
        | "pending"
        | "submitted"
        | "ai_verified"
        | "ai_rejected"
        | "staff_verified"
        | "staff_rejected"
        | "self_verified"
      ticket_status:
        | "open"
        | "pending_payment"
        | "paid"
        | "cancelled"
        | "revealed"
        | "awaiting_story"
        | "awaiting_payment_confirm"
        | "scanned"
        | "approved"
        | "paying"
      verification_method:
        | "ai_call"
        | "video"
        | "postcard"
        | "ai_email"
        | "manual_contact"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_status: ["queued", "generating", "ready", "failed"],
      coupon_status: ["active", "redeemed", "expired", "cancelled"],
      listing_type: ["partner", "web", "unclaimed"],
      member_role: ["owner", "editor", "viewer"],
      plan: ["free", "pro", "ultra"],
      project_fiscal_type: ["formal", "informal"],
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
        "unreachable",
        "unresolved",
      ],
      story_status: [
        "not_required",
        "pending",
        "submitted",
        "ai_verified",
        "ai_rejected",
        "staff_verified",
        "staff_rejected",
        "self_verified",
      ],
      ticket_status: [
        "open",
        "pending_payment",
        "paid",
        "cancelled",
        "revealed",
        "awaiting_story",
        "awaiting_payment_confirm",
        "scanned",
        "approved",
        "paying",
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
} as const
