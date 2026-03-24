export function Alert({ children, className = "", variant = "default", ...props }: { children: React.ReactNode; className?: string; variant?: string }) {
  const styles = variant === "destructive" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200"
  return <div className={`p-4 rounded-md border ${styles} ${className}`} {...props}>{children}</div>
}
export function AlertDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm">{children}</p>
}
