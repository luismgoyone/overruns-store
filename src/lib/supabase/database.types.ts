
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admins": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"order_id": string,"price_centavos": number,"product_name": string,"qty": number,"size": Database["public"]['Enums']["product_size"],"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"order_id": string,"price_centavos": number,"product_name": string,"qty": number,"size": Database["public"]['Enums']["product_size"],"variant_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"order_id"?: string,"price_centavos"?: number,"product_name"?: string,"qty"?: number,"size"?: Database["public"]['Enums']["product_size"],"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": NonNullable<Json>,"amount_mismatch": boolean,"confirmation_sent_at": string | null,"created_at": string,"customer_name": string,"email": string,"id": string,"idempotency_key": string | null,"oversold": boolean,"paid_at": string | null,"payment_conflict": boolean,"paymongo_checkout_id": string | null,"paymongo_checkout_url": string | null,"phone": string,"shipping_centavos": number,"status": Database["public"]['Enums']["order_status"],"subtotal_centavos": number,"total_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "address": NonNullable<Json>,"amount_mismatch"?: boolean,"confirmation_sent_at"?: string | null,"created_at"?: string,"customer_name": string,"email": string,"id"?: string,"idempotency_key"?: string | null,"oversold"?: boolean,"paid_at"?: string | null,"payment_conflict"?: boolean,"paymongo_checkout_id"?: string | null,"paymongo_checkout_url"?: string | null,"phone": string,"shipping_centavos": number,"status"?: Database["public"]['Enums']["order_status"],"subtotal_centavos": number,"total_centavos": number
                  }
                  Update: {
                    "address"?: NonNullable<Json>,"amount_mismatch"?: boolean,"confirmation_sent_at"?: string | null,"created_at"?: string,"customer_name"?: string,"email"?: string,"id"?: string,"idempotency_key"?: string | null,"oversold"?: boolean,"paid_at"?: string | null,"payment_conflict"?: boolean,"paymongo_checkout_id"?: string | null,"paymongo_checkout_url"?: string | null,"phone"?: string,"shipping_centavos"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal_centavos"?: number,"total_centavos"?: number
                  }
                  Relationships: [
                    
                  ]
                },"product_variants": {
                  Row: {
                    "id": string,"product_id": string,"size": Database["public"]['Enums']["product_size"],"stock": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"product_id": string,"size": Database["public"]['Enums']["product_size"],"stock"?: number
                  }
                  Update: {
                    "id"?: string,"product_id"?: string,"size"?: Database["public"]['Enums']["product_size"],"stock"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category": Database["public"]['Enums']["product_category"],"created_at": string,"description": string,"id": string,"images": (string)[],"is_active": boolean,"is_featured": boolean,"name": string,"price_centavos": number,"retail_price_centavos": number | null,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["product_category"],"created_at"?: string,"description"?: string,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"is_featured"?: boolean,"name": string,"price_centavos": number,"retail_price_centavos"?: number | null,"slug": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["product_category"],"created_at"?: string,"description"?: string,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"is_featured"?: boolean,"name"?: string,"price_centavos"?: number,"retail_price_centavos"?: number | null,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_conflicted_payment":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"apply_order_stock":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"create_pending_order":
{ Args: { "p_order": Json }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_order_paid":
{ Args: { "p_checkout_id": string }; Returns: string
                           },
"record_checkout_payment":
{ Args: { "p_checkout_id": string,"p_currency"?: string,"p_paid_centavos"?: number }; Returns: {
              "amount_mismatch": boolean,"order_id": string,"outcome": string,"oversold": boolean
            }[]
                           },
"save_product_stock":
{ Args: { "p_product_id": string,"p_stock": Json }; Returns: undefined
                           }
          }
          Enums: {
            "order_status": "pending"|"paid"|"shipped"|"cancelled","product_category": "tops"|"bottoms"|"outerwear"|"kids"|"accessories","product_size": "XS"|"S"|"M"|"L"|"XL"|"XXL"|"OS"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "order_status": ["pending", "paid", "shipped", "cancelled"],"product_category": ["tops", "bottoms", "outerwear", "kids", "accessories"],"product_size": ["XS", "S", "M", "L", "XL", "XXL", "OS"]
          }
        }
} as const
