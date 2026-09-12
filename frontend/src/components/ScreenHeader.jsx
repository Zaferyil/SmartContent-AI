import React from 'react'

export default function ScreenHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div className="min-w-0">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}
