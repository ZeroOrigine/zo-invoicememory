"use client"
export function BillingInfo({ subscription, ...props }: { subscription?: any; [key: string]: any }) {
  return <div className="p-4 border rounded">
    <h3 className="font-semibold">Current Plan</h3>
    <p>{subscription?.plan || "Free"}</p>
  </div>
}
export default BillingInfo
