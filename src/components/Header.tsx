import React from 'react'
import { ShoppingCart, Search, X, WifiOff, Store } from 'lucide-react'
import type { Categoria } from '../types'

interface HeaderProps {
  storeName: string
  search: string
  setSearch: (v: string) => void
  categories: Categoria[]
  selectedCategory: string | null
  setSelectedCategory: (id: string | null) => void
  cartCount: number
  cartTotal: number
  onOpenCart: () => void
  isOffline: boolean
}

export const Header: React.FC<HeaderProps> = ({
  storeName,
  search,
  setSearch,
  categories,
  selectedCategory,
  setSelectedCategory,
  cartCount,
  cartTotal,
  onOpenCart,
  isOffline,
}) => {
  const totalFmt = cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <header className="sticky top-0 z-30 bg-[#0F3C46] text-white shadow-md">
      {/* Linha Principal */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-white shadow-sm">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg">{storeName || 'Thoth Vendas'}</h1>
            <p className="truncate text-[11px] text-teal-200">Catálogo & Força de Vendas</p>
          </div>
        </div>

        {/* Botão do Carrinho no Topo */}
        <button
          onClick={onOpenCart}
          className="relative flex shrink-0 items-center gap-2 rounded-xl bg-teal-500 px-3.5 py-2.5 text-sm font-bold text-white transition-all active:scale-95 hover:bg-teal-400"
          aria-label="Abrir Pedido"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Pedido</span>
          <span className="sm:hidden text-xs">{totalFmt}</span>
          {cartCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-black text-slate-900 shadow">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Busca & Categorias */}
      <div className="border-t border-white/10 bg-[#082A33]/80 px-4 py-2.5">
        <div className="mx-auto max-w-6xl space-y-2">
          {/* Campo de Busca */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-200/70" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por produto, código ou marca…"
              className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-teal-200/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-1 text-teal-200 hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Categorias em Pílulas */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedCategory === null
                  ? 'bg-amber-400 text-slate-900 shadow'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              Todos os Produtos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  selectedCategory === c.id
                    ? 'bg-amber-400 text-slate-900 shadow'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aviso de Offline */}
      {isOffline && (
        <div className="flex items-center justify-center gap-1.5 bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-slate-900">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Modo Offline — Catálogo local salvo. PDF funciona sem sinal.</span>
        </div>
      )}
    </header>
  )
}
