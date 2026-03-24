"use client"
export function PricingPlans() {
  return <div className="grid grid-cols-3 gap-4">
    <div className="p-4 border rounded"><h3>Free</h3><p>$0/mo</p></div>
    <div className="p-4 border rounded bg-black text-white"><h3>Pro</h3><p>$19/mo</p></div>
    <div className="p-4 border rounded"><h3>Business</h3><p>$49/mo</p></div>
  </div>
}
export default PricingPlans
