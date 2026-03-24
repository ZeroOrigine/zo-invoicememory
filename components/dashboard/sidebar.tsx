"use client"
import Link from "next/link"
export default function Sidebar() {
  return <aside className="w-64 border-r p-4 space-y-2">
    <Link href="/dashboard" className="block p-2 hover:bg-gray-100 rounded">Dashboard</Link>
    <Link href="/invoices" className="block p-2 hover:bg-gray-100 rounded">Invoices</Link>
    <Link href="/billing" className="block p-2 hover:bg-gray-100 rounded">Billing</Link>
    <Link href="/settings" className="block p-2 hover:bg-gray-100 rounded">Settings</Link>
  </aside>
}
