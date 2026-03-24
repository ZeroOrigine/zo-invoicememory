"use client"
export function LoginForm() {
  return (
    <form className="space-y-4">
      <input type="email" placeholder="Email" className="w-full p-2 border rounded" />
      <input type="password" placeholder="Password" className="w-full p-2 border rounded" />
      <button type="submit" className="w-full p-2 bg-black text-white rounded">Log In</button>
    </form>
  )
}
export default LoginForm
