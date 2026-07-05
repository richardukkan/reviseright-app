export const PLANS = {
  free:     { name: 'Free',     pages: 10,  price: 0,   pdf: false, razorpayPlanId: '' },
  scholar:  { name: 'Scholar',  pages: 200, price: 399, pdf: false, razorpayPlanId: 'plan_scholar' },
  topper:   { name: 'Topper',   pages: 500, price: 599, pdf: true,  razorpayPlanId: 'plan_topper' },
  champion: { name: 'Champion', pages: 800, price: 799, pdf: true,  razorpayPlanId: 'plan_champion' },
}
export type PlanKey = keyof typeof PLANS
