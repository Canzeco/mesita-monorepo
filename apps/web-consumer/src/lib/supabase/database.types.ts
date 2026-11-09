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
          money_config: Json
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
          money_config?: Json
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
          money_config?: Json
          reservations_config?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_feedback: {
        Row: {
          consumer_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_feedback_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      business_search_attempts: {
        Row: {
          account_id: string
          at: string
          id: number
        }
        Insert: {
          account_id: string
          at?: string
          id?: never
        }
        Update: {
          account_id?: string
          at?: string
          id?: never
        }
        Relationships: []
      }
      catalog_membership: {
        Row: {
          enabled: boolean
          slug: string
        }
        Insert: {
          enabled?: boolean
          slug: string
        }
        Update: {
          enabled?: boolean
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
          instagram_sync_attempted_at: string | null
          instagram_sync_count: number
          instagram_sync_day: string | null
          instagram_synced_at: string | null
          instagram_verified_at: string | null
          last_name: string | null
          phone: string | null
          plan: string
          reservation_cap_override: number | null
          sex: string | null
          use_instagram_photo: boolean
          vip_partner_id: string | null
          vip_until: string | null
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
          instagram_sync_attempted_at?: string | null
          instagram_sync_count?: number
          instagram_sync_day?: string | null
          instagram_synced_at?: string | null
          instagram_verified_at?: string | null
          last_name?: string | null
          phone?: string | null
          plan?: string
          reservation_cap_override?: number | null
          sex?: string | null
          use_instagram_photo?: boolean
          vip_partner_id?: string | null
          vip_until?: string | null
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
          instagram_sync_attempted_at?: string | null
          instagram_sync_count?: number
          instagram_sync_day?: string | null
          instagram_synced_at?: string | null
          instagram_verified_at?: string | null
          last_name?: string | null
          phone?: string | null
          plan?: string
          reservation_cap_override?: number | null
          sex?: string | null
          use_instagram_photo?: boolean
          vip_partner_id?: string | null
          vip_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumers_vip_partner_id_fkey"
            columns: ["vip_partner_id"]
            isOneToOne: false
            referencedRelation: "vip_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_instagram_token: {
        Row: {
          access_token: string
          expires_at: string | null
          id: boolean
          refreshed_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          id?: boolean
          refreshed_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          id?: boolean
          refreshed_at?: string
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
          checkout_kind: string | null
          consumer_id: string | null
          created_at: string
          currency: string
          early_start: boolean
          ended_at: string | null
          ended_reason: string | null
          id: string
          livemode: boolean
          notice_dismissed_at: string | null
          pending_amount_cents: number | null
          pending_interval: string | null
          pending_tier: string | null
          place_id: string
          queued_at: string
          quoted_credit_cents: number
          quoted_period_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_method_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_interval: string
          checkout_kind?: string | null
          consumer_id?: string | null
          created_at?: string
          currency?: string
          early_start?: boolean
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          livemode?: boolean
          notice_dismissed_at?: string | null
          pending_amount_cents?: number | null
          pending_interval?: string | null
          pending_tier?: string | null
          place_id: string
          queued_at?: string
          quoted_credit_cents?: number
          quoted_period_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_method_id?: string | null
          tier: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_interval?: string
          checkout_kind?: string | null
          consumer_id?: string | null
          created_at?: string
          currency?: string
          early_start?: boolean
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          livemode?: boolean
          notice_dismissed_at?: string | null
          pending_amount_cents?: number | null
          pending_interval?: string | null
          pending_tier?: string | null
          place_id?: string
          queued_at?: string
          quoted_credit_cents?: number
          quoted_period_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_method_id?: string | null
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
      place_charge_tries: {
        Row: {
          addr_hash: string
          id: number
          kind: string
          place_id: string
          tried_at: string
        }
        Insert: {
          addr_hash: string
          id?: never
          kind: string
          place_id: string
          tried_at?: string
        }
        Update: {
          addr_hash?: string
          id?: never
          kind?: string
          place_id?: string
          tried_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_charge_tries_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_charges: {
        Row: {
          amount_cents: number
          code_hash: string
          consumer_id: string | null
          created_at: string
          currency: string
          expires_at: string
          id: string
          paid_at: string | null
          payment_id: string | null
          place_id: string
          ticket: string | null
          token_hash: string
        }
        Insert: {
          amount_cents: number
          code_hash: string
          consumer_id?: string | null
          created_at?: string
          currency: string
          expires_at: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          place_id: string
          ticket?: string | null
          token_hash: string
        }
        Update: {
          amount_cents?: number
          code_hash?: string
          consumer_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          place_id?: string
          ticket?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_charges_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_charges_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "wallet_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_charges_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_codes: {
        Row: {
          code_hash: string
          place_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code_hash: string
          place_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code_hash?: string
          place_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_codes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
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
      place_events: {
        Row: {
          consumer_id: string
          created_at: string
          id: number
          kind: string
          place_id: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: never
          kind: string
          place_id: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: never
          kind?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_events_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
      place_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          place_id: string
          revoked_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          place_id: string
          revoked_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          place_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_invites_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_managers: {
        Row: {
          consumer_id: string
          created_at: string
          expires_at: string
          id: string
          method: string
          note: string | null
          place_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          expires_at?: string
          id?: string
          method: string
          note?: string | null
          place_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          updated_at?: string
          verified_at?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          method?: string
          note?: string | null
          place_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_managers_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_managers_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_manual_premier: {
        Row: {
          created_at: string
          ended_by: string | null
          ends_at: string
          granted_by: string | null
          id: string
          place_id: string
          request_id: string | null
          source: string
          starts_at: string
          tier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_by?: string | null
          ends_at: string
          granted_by?: string | null
          id?: string
          place_id: string
          request_id?: string | null
          source?: string
          starts_at?: string
          tier: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_by?: string | null
          ends_at?: string
          granted_by?: string | null
          id?: string
          place_id?: string
          request_id?: string | null
          source?: string
          starts_at?: string
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_manual_premier_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
      place_payment_accounts: {
        Row: {
          account_country: string | null
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          disabled_reason: string | null
          last_event_created: number | null
          livemode: boolean
          payouts_enabled: boolean
          place_id: string
          requirements_due: Json
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          account_country?: string | null
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          last_event_created?: number | null
          livemode?: boolean
          payouts_enabled?: boolean
          place_id: string
          requirements_due?: Json
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          account_country?: string | null
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          last_event_created?: number | null
          livemode?: boolean
          payouts_enabled?: boolean
          place_id?: string
          requirements_due?: Json
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_payment_accounts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_payment_settings: {
        Row: {
          cashback: boolean
          pay_cards: boolean
          place_id: string
          updated_at: string
          updated_by: string | null
          voucher_1000: boolean
          voucher_200: boolean
          voucher_5000: boolean
          voucher_story: boolean
          voucher_vip: boolean
          voucher_welcome: boolean
        }
        Insert: {
          cashback?: boolean
          pay_cards?: boolean
          place_id: string
          updated_at?: string
          updated_by?: string | null
          voucher_1000?: boolean
          voucher_200?: boolean
          voucher_5000?: boolean
          voucher_story?: boolean
          voucher_vip?: boolean
          voucher_welcome?: boolean
        }
        Update: {
          cashback?: boolean
          pay_cards?: boolean
          place_id?: string
          updated_at?: string
          updated_by?: string | null
          voucher_1000?: boolean
          voucher_200?: boolean
          voucher_5000?: boolean
          voucher_story?: boolean
          voucher_vip?: boolean
          voucher_welcome?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "place_payment_settings_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_premier_periods: {
        Row: {
          backing_id: string | null
          billing_interval: string
          charged_cents: number
          covered_until: string | null
          created_at: string
          credit_cents: number
          cut_from: string | null
          ends_at: string
          extra_days: number
          granted_by: string | null
          id: string
          livemode: boolean
          place_id: string
          price_cents: number
          remaining_at_cover_sec: number | null
          starts_at: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tier: number
          updated_at: string
        }
        Insert: {
          backing_id?: string | null
          billing_interval: string
          charged_cents?: number
          covered_until?: string | null
          created_at?: string
          credit_cents?: number
          cut_from?: string | null
          ends_at: string
          extra_days?: number
          granted_by?: string | null
          id?: string
          livemode?: boolean
          place_id: string
          price_cents?: number
          remaining_at_cover_sec?: number | null
          starts_at: string
          status: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tier: number
          updated_at?: string
        }
        Update: {
          backing_id?: string | null
          billing_interval?: string
          charged_cents?: number
          covered_until?: string | null
          created_at?: string
          credit_cents?: number
          cut_from?: string | null
          ends_at?: string
          extra_days?: number
          granted_by?: string | null
          id?: string
          livemode?: boolean
          place_id?: string
          price_cents?: number
          remaining_at_cover_sec?: number | null
          starts_at?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_premier_periods_backing_id_fkey"
            columns: ["backing_id"]
            isOneToOne: false
            referencedRelation: "place_backings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_premier_periods_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
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
          name: string
          opentable_url: string | null
          payments_enabled: boolean
          phone: string | null
          photos: string[]
          pitch: string | null
          popular_times: Json | null
          prepay_enabled: boolean
          price_level: number | null
          products: Json | null
          profile_photo: string | null
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
          name: string
          opentable_url?: string | null
          payments_enabled?: boolean
          phone?: string | null
          photos?: string[]
          pitch?: string | null
          popular_times?: Json | null
          prepay_enabled?: boolean
          price_level?: number | null
          products?: Json | null
          profile_photo?: string | null
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
          name?: string
          opentable_url?: string | null
          payments_enabled?: boolean
          phone?: string | null
          photos?: string[]
          pitch?: string | null
          popular_times?: Json | null
          prepay_enabled?: boolean
          price_level?: number | null
          products?: Json | null
          profile_photo?: string | null
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
          id: string
          note: string | null
          place_id: string
          reason: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          note?: string | null
          place_id: string
          reason: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
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
      place_shares: {
        Row: {
          consumer_id: string
          place_id: string
          shared_at: string
        }
        Insert: {
          consumer_id: string
          place_id: string
          shared_at?: string
        }
        Update: {
          consumer_id?: string
          place_id?: string
          shared_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_shares_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_shares_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
      place_verification_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumer_id: string
          created_at: string
          expires_at: string
          place_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumer_id: string
          created_at?: string
          expires_at: string
          place_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumer_id?: string
          created_at?: string
          expires_at?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_verification_codes_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_verification_codes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_verification_requests: {
        Row: {
          consumer_id: string
          contact: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          name: string
          note: string | null
          place_id: string
          reviewer_email: string | null
          role: string
          status: string
        }
        Insert: {
          consumer_id: string
          contact?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          name: string
          note?: string | null
          place_id: string
          reviewer_email?: string | null
          role: string
          status?: string
        }
        Update: {
          consumer_id?: string
          contact?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          name?: string
          note?: string | null
          place_id?: string
          reviewer_email?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_verification_requests_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_verification_requests_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_verification_sends: {
        Row: {
          channel: string
          consumer_id: string
          id: number
          place_id: string
          sent_at: string
        }
        Insert: {
          channel: string
          consumer_id: string
          id?: never
          place_id: string
          sent_at?: string
        }
        Update: {
          channel?: string
          consumer_id?: string
          id?: never
          place_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_verification_sends_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_verification_sends_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          boost_tier: number
          content_state: Database["public"]["Enums"]["content_state"]
          created_at: string
          currency: string
          id: string
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
      premier_customers: {
        Row: {
          consumer_id: string
          created_at: string
          livemode: boolean
          stripe_customer: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          livemode?: boolean
          stripe_customer: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          livemode?: boolean
          stripe_customer?: string
        }
        Relationships: [
          {
            foreignKeyName: "premier_customers_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      premier_refill_purchases: {
        Row: {
          amount_cents: number
          consumer_id: string | null
          created_at: string
          currency: string
          days: number
          ends_at: string | null
          id: string
          livemode: boolean
          paid_at: string | null
          place_id: string
          refusal_code: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tier: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          consumer_id?: string | null
          created_at?: string
          currency?: string
          days: number
          ends_at?: string | null
          id?: string
          livemode?: boolean
          paid_at?: string | null
          place_id: string
          refusal_code?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tier: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          consumer_id?: string | null
          created_at?: string
          currency?: string
          days?: number
          ends_at?: string | null
          id?: string
          livemode?: boolean
          paid_at?: string | null
          place_id?: string
          refusal_code?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premier_refill_purchases_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premier_refill_purchases_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
      saved_locations: {
        Row: {
          consumer_id: string
          created_at: string
          custom_name: string | null
          formatted_address: string | null
          id: string
          lat: number
          legacy_name: string | null
          lng: number
          location_kind: string
          name_edited: boolean
          named_at: string | null
          needs_name: boolean
          ordered_at: string
          suggested_name: string | null
          unconfirmed: boolean
          updated_at: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          custom_name?: string | null
          formatted_address?: string | null
          id: string
          lat: number
          legacy_name?: string | null
          lng: number
          location_kind?: string
          name_edited?: boolean
          named_at?: string | null
          needs_name?: boolean
          ordered_at?: string
          suggested_name?: string | null
          unconfirmed?: boolean
          updated_at?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          custom_name?: string | null
          formatted_address?: string | null
          id?: string
          lat?: number
          legacy_name?: string | null
          lng?: number
          location_kind?: string
          name_edited?: boolean
          named_at?: string | null
          needs_name?: boolean
          ordered_at?: string
          suggested_name?: string | null
          unconfirmed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_locations_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_in_calls: {
        Row: {
          called_at: string | null
          phone: string
          requested_at: string | null
        }
        Insert: {
          called_at?: string | null
          phone: string
          requested_at?: string | null
        }
        Update: {
          called_at?: string | null
          phone?: string
          requested_at?: string | null
        }
        Relationships: []
      }
      stripe_connect_events: {
        Row: {
          account: string | null
          created: number
          id: string
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          account?: string | null
          created: number
          id: string
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          account?: string | null
          created?: number
          id?: string
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
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
      vip_invitation_attempts: {
        Row: {
          code_last4: string | null
          consumer_id: string
          created_at: string
          id: number
          outcome: string
        }
        Insert: {
          code_last4?: string | null
          consumer_id: string
          created_at?: string
          id?: never
          outcome: string
        }
        Update: {
          code_last4?: string | null
          consumer_id?: string
          created_at?: string
          id?: never
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_invitation_attempts_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_invitation_codes: {
        Row: {
          code_hash: string
          code_last4: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          revoked_at: string | null
          used_at: string | null
          used_by: string | null
          vip_partner_id: string | null
        }
        Insert: {
          code_hash: string
          code_last4: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
          vip_partner_id?: string | null
        }
        Update: {
          code_hash?: string
          code_last4?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          revoked_at?: string | null
          used_at?: string | null
          used_by?: string | null
          vip_partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_invitation_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_invitation_codes_vip_partner_id_fkey"
            columns: ["vip_partner_id"]
            isOneToOne: false
            referencedRelation: "vip_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_partners: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          place_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          place_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_partners_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_entries: {
        Row: {
          amount_cents: number
          available_at: string
          consumer_id: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          livemode: boolean
          payment_id: string | null
          place_id: string
          purchase_id: string | null
          reason: string | null
        }
        Insert: {
          amount_cents: number
          available_at?: string
          consumer_id?: string | null
          created_at?: string
          currency: string
          id?: string
          kind: string
          livemode?: boolean
          payment_id?: string | null
          place_id: string
          purchase_id?: string | null
          reason?: string | null
        }
        Update: {
          amount_cents?: number
          available_at?: string
          consumer_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          livemode?: boolean
          payment_id?: string | null
          place_id?: string
          purchase_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_entries_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "wallet_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "wallet_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_payments: {
        Row: {
          amount_cents: number
          application_fee_cents: number
          card_cents: number
          cashback_bps: number
          cashback_cents: number
          consumer_id: string | null
          created_at: string
          credit_cents: number
          credit_refunded_cents: number
          currency: string
          expires_at: string | null
          fee_refunded_cents: number
          id: string
          livemode: boolean
          paid_at: string | null
          place_id: string
          proof_seen_at: string | null
          proof_token: string | null
          refunded_cents: number
          request_id: string | null
          settle_tries: number
          status: string
          stripe_account_id: string | null
          stripe_checkout_session_id: string | null
          stripe_error: string | null
          stripe_payment_intent_id: string | null
          ticket: string | null
          tip_cents: number
          tip_refunded_cents: number
          uncovered_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          application_fee_cents?: number
          card_cents?: number
          cashback_bps?: number
          cashback_cents?: number
          consumer_id?: string | null
          created_at?: string
          credit_cents?: number
          credit_refunded_cents?: number
          currency: string
          expires_at?: string | null
          fee_refunded_cents?: number
          id?: string
          livemode?: boolean
          paid_at?: string | null
          place_id: string
          proof_seen_at?: string | null
          proof_token?: string | null
          refunded_cents?: number
          request_id?: string | null
          settle_tries?: number
          status?: string
          stripe_account_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_error?: string | null
          stripe_payment_intent_id?: string | null
          ticket?: string | null
          tip_cents?: number
          tip_refunded_cents?: number
          uncovered_cents?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          application_fee_cents?: number
          card_cents?: number
          cashback_bps?: number
          cashback_cents?: number
          consumer_id?: string | null
          created_at?: string
          credit_cents?: number
          credit_refunded_cents?: number
          currency?: string
          expires_at?: string | null
          fee_refunded_cents?: number
          id?: string
          livemode?: boolean
          paid_at?: string | null
          place_id?: string
          proof_seen_at?: string | null
          proof_token?: string | null
          refunded_cents?: number
          request_id?: string | null
          settle_tries?: number
          status?: string
          stripe_account_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_error?: string | null
          stripe_payment_intent_id?: string | null
          ticket?: string | null
          tip_cents?: number
          tip_refunded_cents?: number
          uncovered_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_payments_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_payments_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_purchases: {
        Row: {
          amount_cents: number
          application_fee_cents: number
          bonus_cents: number
          consumer_id: string | null
          created_at: string
          currency: string
          fee_refunded_cents: number
          id: string
          livemode: boolean
          paid_at: string | null
          place_id: string
          refunded_cents: number
          request_id: string | null
          settle_tries: number
          status: string
          story_activated_at: string | null
          story_token: string | null
          stripe_account_id: string
          stripe_checkout_session_id: string | null
          stripe_error: string | null
          stripe_payment_intent_id: string | null
          uncovered_cents: number
          updated_at: string
          voucher: string | null
        }
        Insert: {
          amount_cents: number
          application_fee_cents?: number
          bonus_cents?: number
          consumer_id?: string | null
          created_at?: string
          currency: string
          fee_refunded_cents?: number
          id?: string
          livemode?: boolean
          paid_at?: string | null
          place_id: string
          refunded_cents?: number
          request_id?: string | null
          settle_tries?: number
          status?: string
          story_activated_at?: string | null
          story_token?: string | null
          stripe_account_id: string
          stripe_checkout_session_id?: string | null
          stripe_error?: string | null
          stripe_payment_intent_id?: string | null
          uncovered_cents?: number
          updated_at?: string
          voucher?: string | null
        }
        Update: {
          amount_cents?: number
          application_fee_cents?: number
          bonus_cents?: number
          consumer_id?: string | null
          created_at?: string
          currency?: string
          fee_refunded_cents?: number
          id?: string
          livemode?: boolean
          paid_at?: string | null
          place_id?: string
          refunded_cents?: number
          request_id?: string | null
          settle_tries?: number
          status?: string
          story_activated_at?: string | null
          story_token?: string | null
          stripe_account_id?: string
          stripe_checkout_session_id?: string | null
          stripe_error?: string | null
          stripe_payment_intent_id?: string | null
          uncovered_cents?: number
          updated_at?: string
          voucher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_purchases_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_purchases_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_refund_attempts: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          error_code: string | null
          id: string
          payment_id: string | null
          purchase_id: string | null
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          id?: string
          payment_id?: string | null
          purchase_id?: string | null
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          id?: string
          payment_id?: string | null
          purchase_id?: string | null
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_refund_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "wallet_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_refund_attempts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "wallet_purchases"
            referencedColumns: ["id"]
          },
        ]
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
          name: string | null
          opentable_url: string | null
          payments_enabled: boolean | null
          phone: string | null
          photos: string[] | null
          pitch: string | null
          popular_times: Json | null
          prepay_enabled: boolean | null
          price_level: number | null
          products: Json | null
          profile_photo: string | null
          reddit_url: string | null
          request_count: number | null
          reservation_channel: string | null
          reservation_target: string | null
          reservations_enabled: boolean | null
          resy_url: string | null
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
      admin_set_guest_reservation_cap: {
        Args: { p_cap: number; p_consumer: string }
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
          instagram_sync_attempted_at: string | null
          instagram_sync_count: number
          instagram_sync_day: string | null
          instagram_synced_at: string | null
          instagram_verified_at: string | null
          last_name: string | null
          phone: string | null
          plan: string
          reservation_cap_override: number | null
          sex: string | null
          use_instagram_photo: boolean
          vip_partner_id: string | null
          vip_until: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "consumers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_guest_standing: {
        Args: {
          p_actor: string
          p_consumer: string
          p_guest_class: string
          p_note: string
          p_note_set: boolean
          p_partner: string
          p_partner_set: boolean
          p_plan: string
          p_vip_until: string
          p_vip_until_set: boolean
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
          instagram_sync_attempted_at: string | null
          instagram_sync_count: number
          instagram_sync_day: string | null
          instagram_synced_at: string | null
          instagram_verified_at: string | null
          last_name: string | null
          phone: string | null
          plan: string
          reservation_cap_override: number | null
          sex: string | null
          use_instagram_photo: boolean
          vip_partner_id: string | null
          vip_until: string | null
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
      business_search_take: {
        Args: { p_account_id: string; p_cap: number }
        Returns: boolean
      }
      catalog_rank: {
        Args: {
          p_exponent: number
          p_families: string[]
          p_half_km: number
          p_known_families: string[]
          p_lat: number
          p_lng: number
          p_nearest?: boolean
          p_premier_1: number
          p_premier_2: number
          p_require_active: boolean
          p_root: number
        }
        Returns: Json
      }
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
      consumer_instagram_claim_scrape: {
        Args: {
          p_consumer_id: string
          p_cooldown_s: number
          p_daily_max: number
          p_kind: string
        }
        Returns: Json
      }
      consumer_instagram_sync: {
        Args: { p_consumer_id: string; p_followers: number; p_handle: string }
        Returns: boolean
      }
      consumer_instagram_verify: {
        Args: { p_consumer_id: string; p_followers: number; p_handle: string }
        Returns: undefined
      }
      consumer_redeem_vip_invitation: {
        Args: { p_code: string; p_consumer: string }
        Returns: string
      }
      expire_saved_location_names: { Args: never; Returns: number }
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
        Args: { p_before?: string; p_limit?: number; p_place_id?: string }
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
      place_charges_sweep: { Args: never; Returns: number }
      place_code_check: {
        Args: { p_hash: string; p_place_id: string }
        Returns: boolean
      }
      place_family_keys: {
        Args: { fallback: string; google_types: Json; stored: string[] }
        Returns: string[]
      }
      place_invite_accept: {
        Args: { p_consumer_id: string; p_email: string }
        Returns: number
      }
      place_money_summary: {
        Args: {
          p_before?: string
          p_before_id?: string
          p_from: string
          p_livemode: boolean
          p_place_id: string
          p_to: string
        }
        Returns: Json
      }
      place_take_code_try: {
        Args: { p_consumer_id: string; p_max: number; p_place_id: string }
        Returns: string
      }
      place_take_verification_send: {
        Args: { p_channel: string; p_consumer_id: string; p_place_id: string }
        Returns: string
      }
      place_transfer_owner: {
        Args: { p_place_id: string; p_to_manager_id: string }
        Returns: boolean
      }
      place_verification_approve: {
        Args: {
          p_consumer_id: string
          p_days: number
          p_method: string
          p_note?: string
          p_place_id: string
          p_request_id?: string
          p_reviewer?: string
        }
        Returns: string
      }
      place_view_counts: {
        Args: { p_place_ids: string[] }
        Returns: {
          place_id: string
          views: number
        }[]
      }
      place_views_days: {
        Args: { p_days?: number; p_place_id: string; p_timezone: string }
        Returns: {
          day: string
          likes: number
          shares: number
          views: number
        }[]
      }
      place_views_events: {
        Args: { p_place_id: string }
        Returns: {
          consumer_id: string
          created_at: string
          kind: string
        }[]
      }
      place_views_log: {
        Args: { p_before?: string; p_limit?: number; p_place_id: string }
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
          plan: string
        }[]
      }
      premier_add_days: {
        Args: {
          p_by: string
          p_days: number
          p_place_id: string
          p_request_id: string
          p_source: string
          p_tier: number
        }
        Returns: Json
      }
      premier_begin_renewal: { Args: { p_place_id: string }; Returns: Json }
      premier_claim: {
        Args: {
          p_backing_id: string
          p_charged_cents: number
          p_checkout_session_id: string
          p_credit_cents: number
          p_extra_days: number
          p_interval: string
          p_livemode: boolean
          p_payment_intent_id: string
          p_price_cents: number
          p_quoted_period_id: string
          p_status: string
          p_tier: string
        }
        Returns: Json
      }
      premier_cover_paid: { Args: { p_place_id: string }; Returns: undefined }
      premier_early_window: {
        Args: { p_place_id: string; p_tier: number }
        Returns: boolean
      }
      premier_end_mesita_days: {
        Args: { p_by: string; p_place_id: string }
        Returns: Json
      }
      premier_interval_end: {
        Args: { p_extra_days: number; p_interval: string; p_start: string }
        Returns: string
      }
      premier_make_payer: {
        Args: { p_backing_id: string; p_payment_method: string }
        Returns: Json
      }
      premier_manual_tier: { Args: { p_place_id: string }; Returns: number }
      premier_refill_check: {
        Args: { p_days: number; p_place_id: string; p_tier: number }
        Returns: Json
      }
      premier_refill_ends: { Args: { p_place_id: string }; Returns: Json }
      premier_refill_settle: {
        Args: { p_payment_intent: string; p_purchase_id: string }
        Returns: Json
      }
      premier_restack: {
        Args: { p_new_id: string; p_new_len: string; p_place_id: string }
        Returns: undefined
      }
      premier_run_end: {
        Args: { p_place_id: string; p_tier: number }
        Returns: string
      }
      premier_settle: {
        Args: {
          p_outcome: string
          p_payment_intent_id: string
          p_period_id: string
        }
        Returns: Json
      }
      premier_tier_rank: { Args: { p_tier: string }; Returns: number }
      recompute_due_place_boosts: { Args: never; Returns: number }
      recompute_place_boost: { Args: { p_place_id: string }; Returns: number }
      seed_place_categories: { Args: never; Returns: undefined }
      seed_place_families: { Args: never; Returns: undefined }
      seed_place_tags: { Args: never; Returns: undefined }
      service_elevenlabs_api_key: { Args: never; Returns: string }
      unstick_enriching_places: {
        Args: { older_than?: string }
        Returns: number
      }
      wallet_activate_story: { Args: { p_token: string }; Returns: Json }
      wallet_balance: {
        Args: {
          p_consumer_id: string
          p_currency: string
          p_livemode: boolean
          p_now?: string
          p_place_id: string
        }
        Returns: {
          available_cents: number
          held_cents: number
          pending_cents: number
          spendable_cents: number
        }[]
      }
      wallet_balances: {
        Args: { p_consumer_id: string; p_livemode: boolean; p_now?: string }
        Returns: {
          available_cents: number
          currency: string
          held_cents: number
          pending_cents: number
          place_id: string
          spendable_cents: number
        }[]
      }
      wallet_credit_purchase: {
        Args: {
          p_available_at?: string
          p_payment_intent: string
          p_purchase_id: string
        }
        Returns: Json
      }
      wallet_give_up: {
        Args: { p_error: string; p_kind: string; p_row_id: string }
        Returns: Json
      }
      wallet_hold_payment: {
        Args: {
          p_application_fee_cents: number
          p_card_cents: number
          p_cashback_bps: number
          p_consumer_id: string
          p_credit_cents: number
          p_currency: string
          p_expires_at: string
          p_livemode: boolean
          p_place_id: string
          p_proof_token: string
          p_request_id: string
          p_stripe_account_id: string
          p_ticket: string
          p_tip_cents: number
        }
        Returns: Json
      }
      wallet_lock: {
        Args: { p_consumer_id: string; p_place_id: string }
        Returns: undefined
      }
      wallet_needs_review_list: {
        Args: { p_before?: string; p_before_id?: string }
        Returns: Json
      }
      wallet_note_fee_refund: {
        Args: { p_fee_refunded_cents: number; p_kind: string; p_row_id: string }
        Returns: Json
      }
      wallet_open_payment: {
        Args: { p_payment_id: string; p_session_id: string }
        Returns: Json
      }
      wallet_pay_credit: {
        Args: {
          p_amount_cents: number
          p_consumer_id: string
          p_currency: string
          p_livemode: boolean
          p_place_id: string
          p_proof_token: string
          p_request_id: string
          p_ticket?: string
        }
        Returns: Json
      }
      wallet_place_outstanding: {
        Args: { p_currency: string; p_livemode: boolean; p_place_id: string }
        Returns: number
      }
      wallet_refund_credit: { Args: { p_attempt_id: string }; Returns: Json }
      wallet_refund_payment: {
        Args: {
          p_amount_refunded: number
          p_payment_id: string
          p_reason?: string
        }
        Returns: Json
      }
      wallet_refund_purchase: {
        Args: {
          p_amount_refunded: number
          p_purchase_id: string
          p_reason?: string
        }
        Returns: Json
      }
      wallet_release_payment: {
        Args: { p_error?: string; p_payment_id: string; p_status: string }
        Returns: Json
      }
      wallet_reopen_settle: {
        Args: { p_kind: string; p_row_id: string }
        Returns: Json
      }
      wallet_settle_batch: {
        Args: { p_limit: number }
        Returns: {
          consumer_id: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          livemode: boolean
          place_id: string
          settle_tries: number
          status: string
          stripe_account_id: string
          stripe_checkout_session_id: string
          voucher: string
        }[]
      }
      wallet_settle_payment: {
        Args: { p_payment_id: string; p_payment_intent: string }
        Returns: Json
      }
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
