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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      lots: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          manager_id: string
          name: string
          status: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          manager_id: string
          name?: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          manager_id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          parent_id: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          parent_id?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          parent_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          category: string
          config: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          mode: string
          name: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          mode?: string
          name: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          mode?: string
          name?: string
        }
        Relationships: []
      }
      shipment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          city: string
          cod_amount: number
          cod_collected: boolean
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          city: string
          cod_amount?: number
          cod_collected?: boolean
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_otp?: string
          distributor_id?: string | null
          id?: string
          is_demo?: boolean
          lot_id?: string | null
          manager_id?: string | null
          notes?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          pincode?: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id?: string | null
          sender_name: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          city?: string
          cod_amount?: number
          cod_collected?: boolean
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_otp?: string
          distributor_id?: string | null
          id?: string
          is_demo?: boolean
          lot_id?: string | null
          manager_id?: string | null
          notes?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          pincode?: string | null
          receiver_address?: string
          receiver_name?: string
          receiver_phone?: string
          rider_id?: string | null
          sender_name?: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipments_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_shipment: {
        Args: { _s: Database["public"]["Tables"]["shipments"]["Row"] }
        Returns: boolean
      }
      chain_role_id: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: string
      }
      claim_shipment: {
        Args: { _code: string }
        Returns: {
          city: string
          cod_amount: number
          cod_collected: boolean
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deliver_with_otp: {
        Args: { _id: string; _otp: string }
        Returns: {
          city: string
          cod_amount: number
          cod_collected: boolean
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      duplicate_shipment: {
        Args: { _copies: number; _id: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ancestor: { Args: { _anc: string; _desc: string }; Returns: boolean }
      seed_demo_orders: {
        Args: { _city?: string; _count: number; _lot?: string }
        Returns: number
      }
      send_delivery_otp: { Args: { _id: string }; Returns: Json }
      track_shipment: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "distributor" | "manager" | "rider"
      shipment_status:
        | "created"
        | "assigned"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "returned"
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
  public: {
    Enums: {
      app_role: ["admin", "distributor", "manager", "rider"],
      shipment_status: [
        "created",
        "assigned",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
      ],
    },
  },
} as const
