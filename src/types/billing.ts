export type PlanName = 'starter' | 'growth' | 'pro'

export interface Plan {
  name:       PlanName
  label:      string
  price:      number       // monthly USD
  priceId:    string       // Stripe price ID (env var)
  features:   string[]
  highlighted?: boolean
}

export interface Purchase {
  id:                         string
  workspace_id:               string
  user_id:                    string
  course_id:                  string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id:   string | null
  amount_cents:               number
  currency:                   string
  status:                     'pending' | 'completed' | 'refunded'
  created_at:                 string
  updated_at:                 string
}

export interface PurchaseWithCourse extends Purchase {
  course: {
    title: string
    slug:  string
  } | null
}

export interface BillingInfo {
  plan_name:              string
  plan_status:            string
  trial_ends_at:          string
  stripe_customer_id:     string | null
  stripe_subscription_id: string | null
  stripe_price_id:        string | null
}
