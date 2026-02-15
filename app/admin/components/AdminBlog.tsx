'use client'

export default function AdminBlog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white">Blog</h1>
        <p className="text-sm text-gray-500 mt-1">Create and manage posts</p>
      </div>
      
      <div className="rounded-2xl border border-white/10 bg-gray-800/30 backdrop-blur p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Coming Soon</h3>
        <p className="text-sm text-gray-400">
          The blog management system is under development. You'll be able to create, edit, and publish posts here.
        </p>
      </div>
    </div>
  )
}
