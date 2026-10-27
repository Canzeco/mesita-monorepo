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
      admin_operator_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          detail: Json
          id: number
          outcome: string
          place_id: string | null
          source: string
          verb: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          outcome: string
          place_id?: string | null
          source: string
          verb: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          outcome?: string
          place_id?: string | null
          source?: string
          verb?: string
        }
        Relationships: []
      }
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
          discovery_config: Json
          enrichment_config: Json
          enrichment_triggers: Json | null
          id: number
          memo_config: Json
          models_config: Json
          reservations_config: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agents_config?: Json
          discovery_config?: Json
          enrichment_config?: Json
          enrichment_triggers?: Json | null
          id?: number
          memo_config?: Json
          models_config?: Json
          reservations_config?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agents_config?: Json
          discovery_config?: Json
          enrichment_config?: Json
          enrichment_triggers?: Json | null
          id?: number
          memo_config?: Json
          models_config?: Json
          reservations_config?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      catalog_membership: {
        Row: {
          family_keys: string[]
          slug: string
        }
        Insert: {
          family_keys: string[]
          slug: string
        }
        Update: {
          family_keys?: string[]
          slug?: string
        }
        Relationships: []
      }
      consumer_analytics_events: {
        Row: {
          consumer_id: string | null
          created_at: string
          event: string
          id: string
          payload: Json
        }
        Insert: {
          consumer_id?: string | null
          created_at?: string
          event: string
          id?: string
          payload?: Json
        }
        Update: {
          consumer_id?: string | null
          created_at?: string
          event?: string
          id?: string
          payload?: Json
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
      consumer_instagram_claims: {
        Row: {
          checked_at: string | null
          code: string
          consumer_id: string
          created_at: string
          handle: string | null
        }
        Insert: {
          checked_at?: string | null
          code: string
          consumer_id: string
          created_at?: string
          handle?: string | null
        }
        Update: {
          checked_at?: string | null
          code?: string
          consumer_id?: string
          created_at?: string
          handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumer_instagram_claims_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: true
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
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "consumer_notifications_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      consumers: {
        Row: {
          appear_anonymous: boolean
          avatar_url: string | null
          birthday: string | null
          code: string | null
          created_at: string
          deleted_at: string | null
          first_name: string | null
          full_name: string | null
          guest_class: string
          guest_class_note: string | null
          guest_class_set_at: string | null
          guest_class_set_by: string | null
          id: string
          instagram_followers_count: number | null
          instagram_handle: string | null
          instagram_verified_at: string | null
          last_name: string | null
          phone: string | null
          plan: string
          sex: string | null
          use_instagram_photo: boolean
        }
        Insert: {
          appear_anonymous?: boolean
          avatar_url?: string | null
          birthday?: string | null
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          full_name?: string | null
          guest_class?: string
          guest_class_note?: string | null
          guest_class_set_at?: string | null
          guest_class_set_by?: string | null
          id: string
          instagram_followers_count?: number | null
          instagram_handle?: string | null
          instagram_verified_at?: string | null
          last_name?: string | null
          phone?: string | null
          plan?: string
          sex?: string | null
          use_instagram_photo?: boolean
        }
        Update: {
          appear_anonymous?: boolean
          avatar_url?: string | null
          birthday?: string | null
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          full_name?: string | null
          guest_class?: string
          guest_class_note?: string | null
          guest_class_set_at?: string | null
          guest_class_set_by?: string | null
          id?: string
          instagram_followers_count?: number | null
          instagram_handle?: string | null
          instagram_verified_at?: string | null
          last_name?: string | null
          phone?: string | null
          plan?: string
          sex?: string | null
          use_instagram_photo?: boolean
        }
        Relationships: []
      }
      place_activity: {
        Row: {
          consumer_id: string
          created_at: string
          kind: string
          lat: number | null
          lng: number | null
          place_id: string
          quiet: boolean
        }
        Insert: {
          consumer_id: string
          created_at?: string
          kind: string
          lat?: number | null
          lng?: number | null
          place_id: string
          quiet?: boolean
        }
        Update: {
          consumer_id?: string
          created_at?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          place_id?: string
          quiet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "place_activity_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_activity_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_backings: {
        Row: {
          amount_cents: number
          billing_interval: string
          cancel_at_period_end: boolean
          consumer_id: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          livemode: boolean
          place_id: string
          show_name: boolean
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_interval: string
          cancel_at_period_end?: boolean
          consumer_id?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          livemode?: boolean
          place_id: string
          show_name?: boolean
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_interval?: string
          cancel_at_period_end?: boolean
          consumer_id?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          livemode?: boolean
          place_id?: string
          show_name?: boolean
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_backings_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_backings_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_categories: {
        Row: {
          created_at: string
          family_keys: string[]
          label: string
          section: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          family_keys?: string[]
          label: string
          section: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          family_keys?: string[]
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
          state: string
          step: string
          step_name: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          meta?: Json
          place_id: string
          state?: string
          step: string
          step_name: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          meta?: Json
          place_id?: string
          state?: string
          step?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_enrichment_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_enrichment_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_enrichment_runs: {
        Row: {
          actor_user_id: string | null
          cost_charges: Json | null
          cost_usd: number | null
          end_reason: string | null
          ended_at: string | null
          entry_stage: string
          id: string
          meta: Json
          outcome: string | null
          place_id: string
          seeded_by: string
          stage_reached: string | null
          started_at: string
          subprocesses: Json | null
          trigger_key: string
        }
        Insert: {
          actor_user_id?: string | null
          cost_charges?: Json | null
          cost_usd?: number | null
          end_reason?: string | null
          ended_at?: string | null
          entry_stage?: string
          id?: string
          meta?: Json
          outcome?: string | null
          place_id: string
          seeded_by: string
          stage_reached?: string | null
          started_at?: string
          subprocesses?: Json | null
          trigger_key: string
        }
        Update: {
          actor_user_id?: string | null
          cost_charges?: Json | null
          cost_usd?: number | null
          end_reason?: string | null
          ended_at?: string | null
          entry_stage?: string
          id?: string
          meta?: Json
          outcome?: string | null
          place_id?: string
          seeded_by?: string
          stage_reached?: string | null
          started_at?: string
          subprocesses?: Json | null
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_enrichment_runs_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_enrichment_runs_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_families: {
        Row: {
          created_at: string
          emoji: string
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji: string
          label: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          emoji?: string
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
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
          state: string
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
          state?: string
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
          state?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_media_assets_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place_profiles"
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
      place_open_events: {
        Row: {
          caller: string
          code: string | null
          consumer_id: string | null
          created_at: string
          google_place_id: string
          id: number
          outcome: string
          place_id: string | null
        }
        Insert: {
          caller: string
          code?: string | null
          consumer_id?: string | null
          created_at?: string
          google_place_id: string
          id?: never
          outcome: string
          place_id?: string | null
        }
        Update: {
          caller?: string
          code?: string | null
          consumer_id?: string | null
          created_at?: string
          google_place_id?: string
          id?: never
          outcome?: string
          place_id?: string | null
        }
        Relationships: []
      }
      place_profiles: {
        Row: {
          address: string | null
          business_state: string | null
          business_state_at: string | null
          category: string | null
          category_label: string | null
          city: string | null
          closes_at: string | null
          created_at: string
          description: string | null
          didi_food_url: string | null
          embedding: string | null
          embedding_source_text: string | null
          enriched_at: string | null
          enrichment: Json
          enrichment_sources: Json | null
          facebook_followers: number | null
          facebook_found: boolean
          facebook_url: string | null
          family_keys: string[] | null
          google_address: Json | null
          google_found: boolean
          google_maps_url: string | null
          google_name: string | null
          google_place_id: string | null
          google_review_count: number | null
          google_reviews: Json | null
          google_source_types: Json
          google_stars_overall: number | null
          google_tags: string[]
          google_types: Json
          hours: Json | null
          id: string
          instagram_followers_count: number | null
          instagram_found: boolean
          instagram_url: string | null
          lat: number | null
          lng: number | null
          menu_pdf_name: string | null
          menu_pdf_url: string | null
          menus: Json | null
          mesita_categories: Json
          name: string
          name_embedding: string | null
          opentable_url: string | null
          payments_enabled: boolean
          phone: string | null
          photos: string[]
          pitch: string | null
          popular_times: Json | null
          prepay_enabled: boolean
          price_level: number | null
          products: Json | null
          reddit_url: string | null
          request_count: number
          reservation_channel: string | null
          reservation_target: string | null
          reservations_enabled: boolean
          resy_url: string | null
          source_sync: Json | null
          story: string | null
          tags: string[]
          threads_url: string | null
          timezone: string | null
          uber_eats_url: string | null
          updated_at: string
          website_url: string | null
          whatsapp_url: string | null
          x_url: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          business_state?: string | null
          business_state_at?: string | null
          category?: string | null
          category_label?: string | null
          city?: string | null
          closes_at?: string | null
          created_at?: string
          description?: string | null
          didi_food_url?: string | null
          embedding?: string | null
          embedding_source_text?: string | null
          enriched_at?: string | null
          enrichment?: Json
          enrichment_sources?: Json | null
          facebook_followers?: number | null
          facebook_found?: boolean
          facebook_url?: string | null
          family_keys?: string[] | null
          google_address?: Json | null
          google_found?: boolean
          google_maps_url?: string | null
          google_name?: string | null
          google_place_id?: string | null
          google_review_count?: number | null
          google_reviews?: Json | null
          google_source_types?: Json
          google_stars_overall?: number | null
          google_tags?: string[]
          google_types?: Json
          hours?: Json | null
          id?: string
          instagram_followers_count?: number | null
          instagram_found?: boolean
          instagram_url?: string | null
          lat?: number | null
          lng?: number | null
          menu_pdf_name?: string | null
          menu_pdf_url?: string | null
          menus?: Json | null
          mesita_categories?: Json
          name: string
          name_embedding?: string | null
          opentable_url?: string | null
          payments_enabled?: boolean
          phone?: string | null
          photos?: string[]
          pitch?: string | null
          popular_times?: Json | null
          prepay_enabled?: boolean
          price_level?: number | null
          products?: Json | null
          reddit_url?: string | null
          request_count?: number
          reservation_channel?: string | null
          reservation_target?: string | null
          reservations_enabled?: boolean
          resy_url?: string | null
          source_sync?: Json | null
          story?: string | null
          tags?: string[]
          threads_url?: string | null
          timezone?: string | null
          uber_eats_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          x_url?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          business_state?: string | null
          business_state_at?: string | null
          category?: string | null
          category_label?: string | null
          city?: string | null
          closes_at?: string | null
          created_at?: string
          description?: string | null
          didi_food_url?: string | null
          embedding?: string | null
          embedding_source_text?: string | null
          enriched_at?: string | null
          enrichment?: Json
          enrichment_sources?: Json | null
          facebook_followers?: number | null
          facebook_found?: boolean
          facebook_url?: string | null
          family_keys?: string[] | null
          google_address?: Json | null
          google_found?: boolean
          google_maps_url?: string | null
          google_name?: string | null
          google_place_id?: string | null
          google_review_count?: number | null
          google_reviews?: Json | null
          google_source_types?: Json
          google_stars_overall?: number | null
          google_tags?: string[]
          google_types?: Json
          hours?: Json | null
          id?: string
          instagram_followers_count?: number | null
          instagram_found?: boolean
          instagram_url?: string | null
          lat?: number | null
          lng?: number | null
          menu_pdf_name?: string | null
          menu_pdf_url?: string | null
          menus?: Json | null
          mesita_categories?: Json
          name?: string
          name_embedding?: string | null
          opentable_url?: string | null
          payments_enabled?: boolean
          phone?: string | null
          photos?: string[]
          pitch?: string | null
          popular_times?: Json | null
          prepay_enabled?: boolean
          price_level?: number | null
          products?: Json | null
          reddit_url?: string | null
          request_count?: number
          reservation_channel?: string | null
          reservation_target?: string | null
          reservations_enabled?: boolean
          resy_url?: string | null
          source_sync?: Json | null
          story?: string | null
          tags?: string[]
          threads_url?: string | null
          timezone?: string | null
          uber_eats_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          x_url?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      place_reports: {
        Row: {
          consumer_id: string
          created_at: string
          note: string | null
          place_id: string
          reason: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          note?: string | null
          place_id: string
          reason: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          note?: string | null
          place_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_reports_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_requests: {
        Row: {
          consumer_id: string
          created_at: string
          place_id: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          place_id: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_requests_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_requests_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_requests_place_id_fkey"
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
          run_id: string | null
          stage: string
          state: string
          subprocesses: Json | null
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
          run_id?: string | null
          stage?: string
          state?: string
          subprocesses?: Json | null
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
          run_id?: string | null
          stage?: string
          state?: string
          subprocesses?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_research_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "place_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_research_place_id_fkey"
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
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          facet: string
          label_en: string
          label_es: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          facet?: string
          label_en?: string
          label_es?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      places: {
        Row: {
          boost_tier: number
          content_state: Database["public"]["Enums"]["content_state"]
          created_at: string
          currency: string
          id: string
          selected: boolean
          slug: string
          state: Database["public"]["Enums"]["place_state"]
          updated_at: string
        }
        Insert: {
          boost_tier?: number
          content_state?: Database["public"]["Enums"]["content_state"]
          created_at?: string
          currency?: string
          id: string
          selected?: boolean
          slug: string
          state?: Database["public"]["Enums"]["place_state"]
          updated_at?: string
        }
        Update: {
          boost_tier?: number
          content_state?: Database["public"]["Enums"]["content_state"]
          created_at?: string
          currency?: string
          id?: string
          selected?: boolean
          slug?: string
          state?: Database["public"]["Enums"]["place_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_place_fk"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "place_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_place_fk"
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
          place_id: string
        }
        Insert: {
          calls?: number
          day: string
          place_id: string
        }
        Update: {
          calls?: number
          day?: string
          place_id?: string
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
          confirmed_at: string | null
          consumer_confirmed_at: string | null
          consumer_id: string
          consumer_notify: string
          consumer_phone: string | null
          created_at: string
          id: string
          is_test: boolean
          last_call_state: string | null
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
          place_id: string
          place_phone: string | null
          reference_code: string | null
          reminder_at: string | null
          reminder_attempts: number
          reminder_conversation_id: string | null
          reminder_state: string
          reported_verdict: string | null
          reschedules_day: string | null
          reschedules_today: number
          reserved_at: string
          run_id: string | null
          state: Database["public"]["Enums"]["reservation_state"]
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
          confirmed_at?: string | null
          consumer_confirmed_at?: string | null
          consumer_id: string
          consumer_notify?: string
          consumer_phone?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          last_call_state?: string | null
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
          place_id: string
          place_phone?: string | null
          reference_code?: string | null
          reminder_at?: string | null
          reminder_attempts?: number
          reminder_conversation_id?: string | null
          reminder_state?: string
          reported_verdict?: string | null
          reschedules_day?: string | null
          reschedules_today?: number
          reserved_at: string
          run_id?: string | null
          state?: Database["public"]["Enums"]["reservation_state"]
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
          confirmed_at?: string | null
          consumer_confirmed_at?: string | null
          consumer_id?: string
          consumer_notify?: string
          consumer_phone?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          last_call_state?: string | null
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
          place_id?: string
          place_phone?: string | null
          reference_code?: string | null
          reminder_at?: string | null
          reminder_attempts?: number
          reminder_conversation_id?: string | null
          reminder_state?: string
          reported_verdict?: string | null
          reschedules_day?: string | null
          reschedules_today?: number
          reserved_at?: string
          run_id?: string | null
          state?: Database["public"]["Enums"]["reservation_state"]
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
            foreignKeyName: "reservation_tickets_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          note: string | null
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          note?: string | null
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          note?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles: {
        Row: {
          address: string | null
          boost_tier: number | null
          business_state: string | null
          business_state_at: string | null
          category: string | null
          category_label: string | null
          city: string | null
          closes_at: string | null
          content_state: Database["public"]["Enums"]["content_state"] | null
          created_at: string | null
          currency: string | null
          description: string | null
          didi_food_url: string | null
          embedding: string | null
          embedding_source_text: string | null
          enriched_at: string | null
          enrichment_sources: Json | null
          facebook_followers: number | null
          facebook_url: string | null
          family_keys: string[] | null
          google_address: Json | null
          google_maps_url: string | null
          google_name: string | null
          google_place_id: string | null
          google_review_count: number | null
          google_reviews: Json | null
          google_source_types: Json | null
          google_stars_overall: number | null
          google_tags: string[] | null
          google_types: Json | null
          hours: Json | null
          id: string | null
          instagram_followers_count: number | null
          instagram_url: string | null
          lat: number | null
          lng: number | null
          menu_pdf_name: string | null
          menu_pdf_url: string | null
          menus: Json | null
          mesita_categories: Json | null
          name: string | null
          name_embedding: string | null
          opentable_url: string | null
          payments_enabled: boolean | null
          phone: string | null
          photos: string[] | null
          pitch: string | null
          popular_times: Json | null
          prepay_enabled: boolean | null
          price_level: number | null
          products: Json | null
          reddit_url: string | null
          request_count: number | null
          reservation_channel: string | null
          reservation_target: string | null
          reservations_enabled: boolean | null
          resy_url: string | null
          selected: boolean | null
          slug: string | null
          source_sync: Json | null
          state: Database["public"]["Enums"]["place_state"] | null
          story: string | null
          tags: string[] | null
          threads_url: string | null
          timezone: string | null
          uber_eats_url: string | null
          updated_at: string | null
          website_url: string | null
          whatsapp_url: string | null
          x_url: string | null
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
      admin_set_guest_standing: {
        Args: {
          p_actor: string
          p_consumer: string
          p_guest_class: string
          p_note: string
          p_note_set: boolean
          p_plan: string
        }
        Returns: {
          appear_anonymous: boolean
          avatar_url: string | null
          birthday: string | null
          code: string | null
          created_at: string
          deleted_at: string | null
          first_name: string | null
          full_name: string | null
          guest_class: string
          guest_class_note: string | null
          guest_class_set_at: string | null
          guest_class_set_by: string | null
          id: string
          instagram_followers_count: number | null
          instagram_handle: string | null
          instagram_verified_at: string | null
          last_name: string | null
          phone: string | null
          plan: string
          sex: string | null
          use_instagram_photo: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "consumers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_place_request: {
        Args: { p_consumer_id: string; p_place_id: string }
        Returns: {
          inserted: boolean
          request_count: number
        }[]
      }
      atlas_family_slugs_valid: { Args: { slugs: string[] }; Returns: boolean }
      bump_reservation_call_counter: { Args: { pid: string }; Returns: number }
      close_place_enrichment_run: {
        Args: {
          p_charges?: Json
          p_cost_usd?: number
          p_meta?: Json
          p_outcome: string
          p_reason?: string
          p_run_id: string
          p_stage?: string
        }
        Returns: boolean
      }
      close_stale_place_enrichment_runs: { Args: never; Returns: number }
      consumer_instagram_verify: {
        Args: { p_consumer_id: string; p_followers: number; p_handle: string }
        Returns: undefined
      }
      families_for_categories: {
        Args: { cats: Json; fallback: string }
        Returns: string[]
      }
      families_for_category: { Args: { cat: string }; Returns: string[] }
      generate_consumer_code: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      open_place_enrichment_run: {
        Args: {
          p_actor_user_id?: string
          p_cooldown_hours?: number
          p_entry_stage?: string
          p_meta?: Json
          p_place_id: string
          p_seeded_by: string
          p_subprocesses?: Json
          p_trigger: string
        }
        Returns: {
          blocked: string
          retry_after: string
          run_id: string
        }[]
      }
      place_activity_feed: {
        Args: { p_limit?: number }
        Returns: {
          anonymous: boolean
          avatar_url: string
          consumer_id: string
          created_at: string
          first_name: string
          guest_class: string
          instagram: boolean
          instagram_followers_count: number
          instagram_handle: string
          kind: string
          lat: number
          lng: number
          place_id: string
          plan: string
        }[]
      }
      place_activity_history_by: {
        Args: {
          p_at: string
          p_kind: string
          p_limit?: number
          p_place_id: string
        }
        Returns: {
          anonymous: boolean
          avatar_url: string
          consumer_id: string
          created_at: string
          first_name: string
          guest_class: string
          instagram: boolean
          instagram_followers_count: number
          instagram_handle: string
          kind: string
          place_id: string
          plan: string
        }[]
      }
      place_activity_people: {
        Args: { p_limit?: number; p_place_id: string }
        Returns: {
          avatar_url: string
          consumer_id: string
          created_at: string
          first_name: string
          guest_class: string
          instagram_followers_count: number
          instagram_handle: string
          kind: string
          plan: string
          total: number
        }[]
      }
      place_activity_visible: {
        Args: { c: Database["public"]["Tables"]["consumers"]["Row"] }
        Returns: boolean
      }
      place_family_keys: {
        Args: { fallback: string; google_types: Json; stored: string[] }
        Returns: string[]
      }
      recompute_place_boost: { Args: { p_place_id: string }; Returns: number }
      run_place_enrichment_stages: { Args: never; Returns: number }
      seed_place_categories: { Args: never; Returns: undefined }
      seed_place_families: { Args: never; Returns: undefined }
      seed_place_tags: { Args: never; Returns: undefined }
      service_elevenlabs_api_key: { Args: never; Returns: string }
    }
    Enums: {
      content_state: "generating" | "ready" | "failed"
      place_state: "active" | "paused" | "archived"
      reservation_state:
        | "pending"
        | "confirmed"
        | "declined"
        | "cancelled"
        | "unreachable"
        | "unresolved"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      content_state: ["generating", "ready", "failed"],
      place_state: ["active", "paused", "archived"],
      reservation_state: [
        "pending",
        "confirmed",
        "declined",
        "cancelled",
        "unreachable",
        "unresolved",
      ],
    },
  },
} as const
